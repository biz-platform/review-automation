/**
 * Playwright로 self 페이지 로드 후, 페이지가 직접 요청하는 리뷰 API 응답을 가로채서 반환.
 * page.evaluate(fetch)는 배민이 래핑한 fetch를 타서 실패하므로, 응답 캡처 방식 사용.
 */
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";

const SELF_URL = "https://self.baemin.com";
const BROWSER_TIMEOUT_MS = 45_000;
const CAPTURE_TIMEOUT_MS = 25_000;

function toPlaywrightCookies(cookies: CookieItem[], origin: string): Array<{ name: string; value: string; domain: string; path: string }> {
  const url = new URL(origin);
  const domain = url.hostname === "self.baemin.com" ? ".baemin.com" : url.hostname;
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
};

const PAGE_CAPTURE_TIMEOUT_MS = 20_000;

const SCROLL_POLL_MS = 2_000;
const MAX_SCROLLS_WITHOUT_NEW = 5;

/** 리스트 응답인지(aggregate/count 제외) */
function isListBody(body: unknown): body is { next?: boolean; reviews?: unknown[] } {
  return (
    typeof body === "object" &&
    body != null &&
    "reviews" in body &&
    Array.isArray((body as { reviews?: unknown[] }).reviews)
  );
}

const LOG = "[baemin-browser-review]";

/** "[음식배달] 평화족발 / 족발·보쌈 14680344" → "족발·보쌈" */
function parseCategoryFromOptionText(text: string): string | null {
  const afterSlash = text.split(" / ")[1];
  if (!afterSlash) return null;
  const category = afterSlash.replace(/\s+\d+$/, "").trim();
  return category || null;
}

/** id 기준 중복 제거 후 누적 (배민 API는 id를 number로 줌) */
function mergeReviews(acc: Map<string, unknown>, reviews: unknown[]): void {
  for (const r of reviews) {
    const raw = (r as { id?: string | number }).id;
    const id = raw != null && (typeof raw === "string" || typeof raw === "number") ? String(raw) : undefined;
    if (id) acc.set(id, r);
    else if (acc.size < 3) {
      console.log(LOG, "mergeReviews skip (no id)", { keys: r != null ? Object.keys(r as object) : null });
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
  }
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const { countRef, timeoutMs = PAGE_CAPTURE_TIMEOUT_MS } = options;
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      page.off("response", handler);
      reject(new Error(`리뷰 API 응답 대기 시간 초과(${timeoutMs / 1000}초).`));
    }, timeoutMs);

    const handler = async (response: import("playwright").Response) => {
      const url = response.url();
      const method = response.request().method();
      if (method !== "GET" || !url.includes("/v1/review/shops/") || !url.includes("/reviews")) return;

      try {
        const body = await response.json().catch(() => response.text());

        if (url.includes("/reviews/count")) {
          if (response.ok() && countRef.current == null) {
            countRef.current =
              typeof body === "object" && body != null ? (body as BaeminReviewCountBody) : null;
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
export async function fetchBaeminReviewViaBrowser(
  storeId: string,
  userId: string,
  query: {
    from: string;
    to: string;
    offset?: string;
    limit?: string;
    fetchAll?: boolean;
  }
): Promise<BaeminReviewViaBrowserResult> {
  const shopNo = await BaeminSession.getBaeminShopId(storeId, userId);
  if (!shopNo) {
    throw new Error("배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.");
  }
  const cookies = await BaeminSession.getBaeminCookies(storeId, userId);
  if (!cookies?.length) {
    throw new Error("배민 세션이 없습니다. 먼저 쿠키를 등록해 주세요.");
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요."
    );
  }

  logMemory("[baemin-browser-review] before launch");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory("[baemin-browser-review] after launch");
  logBrowserMemory(browser as unknown, "[baemin-browser-review] browser");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));

    const page = await context.newPage();
    const reviewsPath = `/shops/${shopNo}/reviews`;
    const limitStr = query.limit ?? "10";
    const fetchAll = query.fetchAll === true;

    const countRef: { current: BaeminReviewCountBody | null } = { current: null };
    const reviewsById = new Map<string, unknown>();

    const search = new URLSearchParams({
      from: query.from,
      to: query.to,
      offset: "0",
      limit: limitStr,
    }).toString();

    // 스크롤 시 추가로 오는 list 응답까지 모두 누적하는 리스너 (첫 응답 전에 등록)
    const persistentHandler = async (response: import("playwright").Response) => {
      const url = response.url();
      const method = response.request().method();
      if (method !== "GET" || !url.includes("/v1/review/shops/") || !url.includes("/reviews")) return;

      try {
        const body = await response.json().catch(() => response.text());

        if (url.includes("/reviews/count")) {
          if (response.ok() && countRef.current == null) {
            countRef.current =
              typeof body === "object" && body != null ? (body as BaeminReviewCountBody) : null;
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
          console.log(LOG, "persistentHandler list", { url, chunkLen: chunk.length });
          mergeReviews(reviewsById, chunk);
        } else if (!url.includes("/count")) {
          console.log(LOG, "persistentHandler not list", { url, bodyKeys: typeof body === "object" && body != null ? Object.keys(body as object) : "non-object" });
        }
      } catch (e) {
        console.log(LOG, "persistentHandler error", url, e);
      }
    };
    page.on("response", persistentHandler);

    const firstCapturePromise = waitFirstListResponse(page, {
      countRef,
      timeoutMs: CAPTURE_TIMEOUT_MS,
    });
    await page.goto(`${SELF_URL}${reviewsPath}?${search}`, {
      waitUntil: "domcontentloaded",
      timeout: BROWSER_TIMEOUT_MS,
    });
    await dismissBaeminTodayPopup(page);
    await page.waitForSelector("select option", { state: "attached", timeout: 8_000 }).catch(() => null);

    const optionLabel = await page
      .locator(`select option[value="${shopNo}"]`)
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);
    const shop_category = optionLabel ? parseCategoryFromOptionText(optionLabel.trim()) : null;
    if (shop_category != null) console.log(LOG, "shop_category", shop_category);
    else if (optionLabel == null) console.log(LOG, "shop_category skipped (select option not found)");

    const firstResult = await firstCapturePromise;

    const firstList = firstResult.body as { next: boolean; reviews: unknown[] };
    const firstChunk = firstList.reviews ?? [];
    console.log(LOG, "first list", {
      ok: firstResult.ok,
      firstChunkLen: firstChunk.length,
      firstItemKeys: firstChunk[0] != null ? Object.keys(firstChunk[0] as object) : null,
    });

    if (!firstResult.ok) {
      const msg =
        typeof firstResult.body === "string"
          ? firstResult.body
          : (firstResult.body as { errorMessage?: string })?.errorMessage ?? String(firstResult.body);
      throw new Error(`배민 API ${firstResult.status}: ${msg}`);
    }

    mergeReviews(reviewsById, firstList.reviews ?? []);
    const countBody = countRef.current;
    const targetCount = countBody?.reviewCount;

    console.log(LOG, "after first merge", { reviewsByIdSize: reviewsById.size, targetCount });

    // fetchAll: End 키로 끝까지 스크롤, 더 이상 새 응답 없을 때까지 반복
    if (fetchAll) {
      let scrollsWithoutNew = 0;
      let scrollRound = 0;
      while (scrollsWithoutNew < MAX_SCROLLS_WITHOUT_NEW) {
        await dismissBaeminTodayPopup(page);
        const prevSize = reviewsById.size;
        await page.keyboard.press("End");
        await page.waitForTimeout(SCROLL_POLL_MS);
        scrollRound++;
        console.log(LOG, "scroll", { scrollRound, prevSize, currentSize: reviewsById.size, targetCount });
        if (targetCount != null && reviewsById.size >= targetCount) break;
        if (reviewsById.size === prevSize) scrollsWithoutNew++;
        else scrollsWithoutNew = 0;
      }
    }

    const allReviews = Array.from(reviewsById.values());
    console.log(LOG, "return", { allReviewsLen: allReviews.length, firstKeys: allReviews[0] != null ? Object.keys(allReviews[0] as object) : null });

    return {
      list: { next: fetchAll ? false : firstList.next, reviews: allReviews },
      count: countBody ?? undefined,
      shop_category: shop_category ?? undefined,
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[baemin-browser-review]");
  }
}

/**
 * @deprecated count+list 한 번에 쓰려면 fetchBaeminReviewViaBrowser 사용
 */
export async function fetchBaeminReviewListViaBrowser(
  storeId: string,
  userId: string,
  query: { from: string; to: string; offset?: string; limit?: string }
): Promise<{ next: boolean; reviews: unknown[] }> {
  const { list } = await fetchBaeminReviewViaBrowser(storeId, userId, query);
  return list;
}
