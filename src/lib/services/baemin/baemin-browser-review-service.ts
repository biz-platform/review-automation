/**
 * Playwright로 self 페이지 로드 후, 페이지가 직접 요청하는 리뷰 API 응답을 가로채서 반환.
 * page.evaluate(fetch)는 배민이 래핑한 fetch를 타서 실패하므로, 응답 캡처 방식 사용.
 */
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_CAPTURE_RESPONSE_TIMEOUT_MS,
  PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
  PLAYWRIGHT_PAGE_LISTEN_TIMEOUT_MS,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";
import {
  parseCategoryFromBaeminShopOptionText,
  parseShopNameFromBaeminShopOptionText,
} from "@/lib/services/baemin/baemin-shop-option-label";
import { isBaeminReviewExcludedFromSync } from "@/lib/services/baemin/baemin-review-sync-exclude";

const SELF_URL = "https://self.baemin.com";

function toPlaywrightCookies(
  cookies: CookieItem[],
  origin: string,
): Array<{ name: string; value: string; domain: string; path: string }> {
  const url = new URL(origin);
  const domain =
    url.hostname === "self.baemin.com" ? ".baemin.com" : url.hostname;
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? domain,
    path: c.path ?? "/",
  }));
}

export type BaeminReviewCountBody = {
  reviewCount?: number;
  noCommentReviewCount?: number;
  blockedReviewCount?: number;
  recentReviewCount?: number;
  [key: string]: unknown;
};

export type BaeminReviewViaBrowserResult = {
  list: { next: boolean; reviews: unknown[] };
  count?: BaeminReviewCountBody;
  shop_category?: string | null;
  /** 리뷰 페이지 매장 select에서 파싱한 표시명 */
  shop_name?: string | null;
};

/** fetchAll 시 스크롤 후 새 데이터 도착 대기: 이 시간까지 오면 "추가 없음"으로 간주 */
const SCROLL_WAIT_FOR_NEW_MS = 250;
/** 위 대기 시 폴링 간격 */
const SCROLL_WAIT_POLL_MS = 150;
const MAX_SCROLLS_WITHOUT_NEW = 15;

/** 리스트 응답인지(aggregate/count 제외) */
function isListBody(
  body: unknown,
): body is { next?: boolean; reviews?: unknown[] } {
  return (
    typeof body === "object" &&
    body != null &&
    "reviews" in body &&
    Array.isArray((body as { reviews?: unknown[] }).reviews)
  );
}

const LOG = "[baemin-browser-review]";

/** id 기준 중복 제거 후 누적 (배민 API는 id를 number로 줌) */
function mergeReviews(acc: Map<string, unknown>, reviews: unknown[]): void {
  for (const r of reviews) {
    if (isBaeminReviewExcludedFromSync(r)) continue;
    const raw = (r as { id?: string | number }).id;
    const id =
      raw != null && (typeof raw === "string" || typeof raw === "number")
        ? String(raw)
        : undefined;
    if (id) acc.set(id, r);
    else if (acc.size < 3) {
      console.log(LOG, "mergeReviews skip (no id)", {
        keys: r != null ? Object.keys(r as object) : null,
      });
    }
  }
}

/**
 * 첫 리스트 응답 한 번 캡처 (count는 handler에서 채움). 타임아웃 시 실패.
 */
async function waitFirstListResponse(
  page: import("playwright").Page,
  options: {
    countRef: { current: BaeminReviewCountBody | null };
    timeoutMs?: number;
  },
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const { countRef, timeoutMs = PLAYWRIGHT_PAGE_LISTEN_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      page.off("response", handler);
      reject(new Error(`리뷰 API 응답 대기 시간 초과(${timeoutMs / 1000}초).`));
    }, timeoutMs);

    const handler = async (response: import("playwright").Response) => {
      const url = response.url();
      const method = response.request().method();
      if (
        method !== "GET" ||
        !url.includes("/v1/review/shops/") ||
        !url.includes("/reviews")
      )
        return;

      try {
        const body = await response.json().catch(() => response.text());

        if (url.includes("/reviews/count")) {
          if (response.ok() && countRef.current == null) {
            countRef.current =
              typeof body === "object" && body != null
                ? (body as BaeminReviewCountBody)
                : null;
          }
          return;
        }

        const isAggregate =
          typeof body === "object" &&
          body != null &&
          ("recentRating" in body || "ratingCounts" in body);
        if (isAggregate) return;

        if (!isListBody(body)) return;

        clearTimeout(t);
        page.off("response", handler);
        resolve({ ok: response.ok(), status: response.status(), body });
      } catch {
        // ignore
      }
    };

    page.on("response", handler);
  });
}

/**
 * 리뷰 페이지 한 번 로드 후, fetchAll이면 End 키로 끝까지 스크롤하며
 * 페이지가 요청하는 리뷰 API 응답을 모두 캡처해 합친다. (offset 반복 goto 제거)
 */
export type FetchBaeminReviewViaBrowserOptions = {
  isCancelled?: () => Promise<boolean>;
  /** 신규 로그인 세션으로 수집 시 사용 (DB 쿠키 대신) */
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

export async function fetchBaeminReviewViaBrowser(
  storeId: string,
  userId: string,
  query: {
    from: string;
    to: string;
    offset?: string;
    limit?: string;
    fetchAll?: boolean;
  },
  options?: FetchBaeminReviewViaBrowserOptions,
): Promise<BaeminReviewViaBrowserResult> {
  let shopNo: string;
  let cookies: CookieItem[];
  if (options?.sessionOverride) {
    shopNo = options.sessionOverride.shopNo;
    cookies = options.sessionOverride.cookies;
  } else {
    shopNo = (await BaeminSession.getBaeminShopId(storeId, userId)) ?? "";
    if (!shopNo) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error("배민 세션이 없습니다. 먼저 쿠키를 등록해 주세요.");
    }
    cookies = stored;
  }
  if (!cookies.length) {
    throw new Error("배민 세션이 없습니다. 먼저 쿠키를 등록해 주세요.");
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const headless = isPlaywrightHeadlessDefault();
  logMemory("[baemin-browser-review] before launch");
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory("[baemin-browser-review] after launch");
  logBrowserMemory(browser as unknown, "[baemin-browser-review] browser");

  const routePattern = "**/v1/review/shops/*/reviews**";
  let page: import("playwright").Page | null = null;
  let responseListener:
    | ((response: import("playwright").Response) => Promise<void>)
    | null = null;

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });

    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));

    page = await context.newPage();
    const reviewsPath = `/shops/${shopNo}/reviews`;
    const limitStr = query.limit ?? "10";
    const fetchAll = query.fetchAll === true;

    const countRef: { current: BaeminReviewCountBody | null } = {
      current: null,
    };
    const reviewsById = new Map<string, unknown>();

    const search = new URLSearchParams({
      from: query.from,
      to: query.to,
      offset: "0",
      limit: limitStr,
    }).toString();

    /**
     * IMPORTANT:
     * 배민 셀프 페이지는 URL query(from/to)를 무시하고 내부 기본 필터(최근 180일 등)로
     * self-api를 호출할 수 있다. 그래서 job payload로 30일을 내려도 실제 수집은 180일이 될 수 있음.
     *
     * 해결: 페이지가 요청하는 리뷰 API의 from/to를 항상 query.from/query.to로 강제한다.
     * (예: /v1/review/shops/{shopNo}/reviews, /v1/review/shops/{shopNo}/reviews/count)
     */
    await page.route(routePattern, async (route) => {
      const req = route.request();
      if (req.method() !== "GET") return route.continue();
      try {
        const url = new URL(req.url());
        url.searchParams.set("from", query.from);
        url.searchParams.set("to", query.to);
        // limit은 payload 기준(기본 10)으로 통일. offset은 페이지가 요청한 값을 유지.
        url.searchParams.set("limit", limitStr);
        await route.continue({ url: url.toString() });
      } catch {
        await route.continue();
      }
    });

    // 스크롤 시 추가로 오는 list 응답까지 모두 누적하는 리스너 (첫 응답 전에 등록)
    responseListener = async (response: import("playwright").Response) => {
      const url = response.url();
      const method = response.request().method();
      if (
        method !== "GET" ||
        !url.includes("/v1/review/shops/") ||
        !url.includes("/reviews")
      )
        return;

      try {
        const body = await response.json().catch(() => response.text());

        if (url.includes("/reviews/count")) {
          if (response.ok() && countRef.current == null) {
            countRef.current =
              typeof body === "object" && body != null
                ? (body as BaeminReviewCountBody)
                : null;
          }
          return;
        }

        const isAggregate =
          typeof body === "object" &&
          body != null &&
          ("recentRating" in body || "ratingCounts" in body);
        if (isAggregate) return;

        if (isListBody(body)) {
          const chunk = body.reviews ?? [];
          console.log(LOG, "persistentHandler list", {
            url,
            chunkLen: chunk.length,
          });
          mergeReviews(reviewsById, chunk);
        } else if (!url.includes("/count")) {
          console.log(LOG, "persistentHandler not list", {
            url,
            bodyKeys:
              typeof body === "object" && body != null
                ? Object.keys(body as object)
                : "non-object",
          });
        }
      } catch (e) {
        console.log(LOG, "persistentHandler error", url, e);
      }
    };
    page.on("response", responseListener);

    const firstCapturePromise = waitFirstListResponse(page, {
      countRef,
      timeoutMs: PLAYWRIGHT_CAPTURE_RESPONSE_TIMEOUT_MS,
    });
    await page.goto(`${SELF_URL}${reviewsPath}?${search}`, {
      waitUntil: "domcontentloaded",
      timeout: PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
    });
    await dismissBaeminTodayPopup(page);
    await page
      .waitForSelector("select option", { state: "attached", timeout: 8_000 })
      .catch(() => null);

    const optionLabel = await page
      .locator(`select option[value="${shopNo}"]`)
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);
    const trimmedLabel = optionLabel?.trim() ?? null;
    const shop_category = trimmedLabel
      ? parseCategoryFromBaeminShopOptionText(trimmedLabel)
      : null;
    const shop_name = trimmedLabel
      ? parseShopNameFromBaeminShopOptionText(trimmedLabel)
      : null;
    if (shop_category != null) console.log(LOG, "shop_category", shop_category);
    if (shop_name != null) console.log(LOG, "shop_name from select", shop_name);
    else if (optionLabel == null)
      console.log(LOG, "shop meta skipped (select option not found)");

    const firstResult = await firstCapturePromise;

    const firstList = firstResult.body as { next: boolean; reviews: unknown[] };
    const firstChunk = firstList.reviews ?? [];
    console.log(LOG, "first list", {
      ok: firstResult.ok,
      firstChunkLen: firstChunk.length,
      firstItemKeys:
        firstChunk[0] != null ? Object.keys(firstChunk[0] as object) : null,
    });

    if (!firstResult.ok) {
      const msg =
        typeof firstResult.body === "string"
          ? firstResult.body
          : ((firstResult.body as { errorMessage?: string })?.errorMessage ??
            String(firstResult.body));
      throw new Error(`배민 API ${firstResult.status}: ${msg}`);
    }

    mergeReviews(reviewsById, firstList.reviews ?? []);
    const countBody = countRef.current;
    /** 로깅용. `/reviews/count`의 reviewCount는 목록·기간·노출 기준과 안 맞는 경우가 있어 수집 종료 판정에 쓰지 않는다. */
    const targetCount = countBody?.reviewCount;

    console.log(LOG, "after first merge", {
      reviewsByIdSize: reviewsById.size,
      targetCount,
    });

    // fetchAll: window.scrollBy + mouse.wheel으로 infinite scroll 트리거. End 키는 이 페이지에서 다음 로드를 안 함.
    if (fetchAll) {
      let scrollsWithoutNew = 0;
      let scrollRound = 0;
      const scrollStepPx = 2000;
      const isCancelled = options?.isCancelled;
      while (scrollsWithoutNew < MAX_SCROLLS_WITHOUT_NEW) {
        if (isCancelled && (await isCancelled())) {
          throw new Error("CANCELLED");
        }
        await dismissBaeminTodayPopup(page);
        const prevSize = reviewsById.size;
        const scrollTarget = await page.evaluate((step) => {
          const main = document.querySelector("main");
          if (main && main.scrollHeight > main.clientHeight) {
            main.scrollTop += step;
            return "main";
          }
          const candidates = document.querySelectorAll(
            "div[style*='overflow'], [class*='scroll'], [class*='list'], [class*='review']",
          );
          for (const el of candidates) {
            const style = window.getComputedStyle(el);
            const overflowY = style.overflowY || style.overflow;
            if (
              (overflowY === "auto" || overflowY === "scroll") &&
              el.scrollHeight > el.clientHeight
            ) {
              (el as HTMLElement).scrollTop += step;
              return "container";
            }
          }
          window.scrollBy(0, step);
          return "window";
        }, scrollStepPx);
        if (scrollTarget === "window") {
          await page.mouse.wheel(0, scrollStepPx);
        }
        // 새 청크가 handler로 합쳐질 때까지 대기(최대 SCROLL_WAIT_FOR_NEW_MS). 추가 수집 시에만 round 리셋.
        const deadline = Date.now() + SCROLL_WAIT_FOR_NEW_MS;
        while (Date.now() < deadline && reviewsById.size === prevSize) {
          await page.waitForTimeout(SCROLL_WAIT_POLL_MS);
        }
        const currentSize = reviewsById.size;
        const gotNew = currentSize > prevSize;
        if (gotNew) scrollsWithoutNew = 0;
        else scrollsWithoutNew++;
        scrollRound++;
        console.log(LOG, "scroll", {
          scrollRound,
          scrollsWithoutNew,
          scrollTarget,
          prevSize,
          currentSize,
          targetCount,
          gotNew,
        });
        // reviewCount(카운트 API) == merge 후 건수로 조기 break 하면, 카운트가 최근n건·필터 불일치 등으로
        // 실제 스크롤로 더 내려갈 수 있는 건(예: DB에 3건만 쌓임)이 나올 수 있음. 종료는 gotNew=연속 n회만.
      }
    }

    const allReviews = Array.from(reviewsById.values());
    console.log(LOG, "return", {
      allReviewsLen: allReviews.length,
      firstKeys:
        allReviews[0] != null ? Object.keys(allReviews[0] as object) : null,
    });

    return {
      list: { next: fetchAll ? false : firstList.next, reviews: allReviews },
      count: countBody ?? undefined,
      shop_category: shop_category ?? undefined,
      shop_name: shop_name ?? undefined,
    };
  } finally {
    if (page != null && responseListener != null) {
      try {
        page.off("response", responseListener);
      } catch {
        /* page 이미 닫힘 등 */
      }
    }
    if (page != null) {
      try {
        await page.unroute(routePattern);
      } catch {
        /* */
      }
    }
    await closeBrowserWithMemoryLog(browser, "[baemin-browser-review]");
  }
}

/**
 * @deprecated count+list 한 번에 쓰려면 fetchBaeminReviewViaBrowser 사용
 */
export async function fetchBaeminReviewListViaBrowser(
  storeId: string,
  userId: string,
  query: { from: string; to: string; offset?: string; limit?: string },
): Promise<{ next: boolean; reviews: unknown[] }> {
  const { list } = await fetchBaeminReviewViaBrowser(storeId, userId, query);
  return list;
}
