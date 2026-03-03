import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { getDefaultReviewDateRange, toYYYYMMDD } from "@/lib/utils/review-date-range";
import * as CoupangEatsSession from "./coupang-eats-session-service";

const REVIEWS_PAGE_URL =
  "https://store.coupangeats.com/merchant/management/reviews";
const REFERER = "https://store.coupangeats.com/merchant/management/reviews";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const BROWSER_HEADERS = {
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua":
    '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};

/** 디버그: DEBUG_COUPANG_EATS_SYNC=1 pnpm worker 로 실행 시 리뷰 수집 단계별 로그 출력 */
const DEBUG = process.env.DEBUG_COUPANG_EATS_SYNC === "1";
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log("[coupang-eats-sync]", ...args);
}

export type CoupangEatsReviewItem = {
  orderReviewId: number;
  storeId?: number;
  comment: string;
  rating: number;
  customerName: string;
  createdAt: string;
  [key: string]: unknown;
};

export type CoupangEatsReviewSearchResponse = {
  data?: {
    content?: CoupangEatsReviewItem[];
    total?: number;
    pageNumber?: number;
    pageSize?: number;
  };
  error?: unknown;
  code?: string;
};

export type CoupangEatsSessionOverride = {
  cookies: CookieItem[];
  external_shop_id?: string | null;
};

/**
 * 저장된 쿠키로 Playwright 브라우저에서 리뷰 API 페이지네이션 호출 후 전체 수집.
 * sessionOverride 있으면 해당 쿠키·external_shop_id 사용 (sync 시 재로그인 후 호출용).
 */
export async function fetchAllCoupangEatsReviews(
  storeId: string,
  userId: string,
  options?: { sessionOverride?: CoupangEatsSessionOverride },
): Promise<{ list: CoupangEatsReviewItem[]; total: number }> {
  let externalStoreId: string | null;
  let cookies: CookieItem[];

  debugLog("fetchAll start", { storeId, hasSessionOverride: !!options?.sessionOverride });

  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
    externalStoreId =
      options.sessionOverride.external_shop_id != null &&
      String(options.sessionOverride.external_shop_id).trim() !== ""
        ? String(options.sessionOverride.external_shop_id)
        : await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
    debugLog("sessionOverride", { cookieCount: cookies.length, external_shop_id: externalStoreId ?? "null" });
    if (!externalStoreId) {
      throw new Error(
        "쿠팡이츠 연동 정보(storeId)가 없습니다. 먼저 연동을 진행해 주세요.",
      );
    }
  } else {
    externalStoreId = await CoupangEatsSession.getCoupangEatsStoreId(
      storeId,
      userId,
    );
    debugLog("from DB", { external_shop_id: externalStoreId ?? "null" });
    if (!externalStoreId) {
      throw new Error(
        "쿠팡이츠 연동 정보(storeId)가 없습니다. 먼저 연동을 진행해 주세요.",
      );
    }
    const stored = await CoupangEatsSession.getCoupangEatsCookies(
      storeId,
      userId,
    );
    if (!stored?.length) {
      throw new Error(
        "저장된 쿠팡이츠 세션이 없습니다. 먼저 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    debugLog("from DB cookies", { count: stored.length });
  }

  const { since, to } = getDefaultReviewDateRange();
  const startDateTime = toYYYYMMDD(since);
  const exclusiveEndDateTime = toYYYYMMDD(
    new Date(to.getTime() + 86400000)
  );
  debugLog("date range", { since: startDateTime, to: exclusiveEndDateTime });

  const list = await fetchReviewsWithPlaywright(
    externalStoreId,
    cookies,
    startDateTime,
    exclusiveEndDateTime,
  );
  const total = list.length;
  debugLog("fetchAll done", { listLength: list.length, total });
  return { list, total };
}

/** 리뷰 페이지 모달(포장 이용 안내, 메뉴/할인 설정, 공지 등) 닫기. X 버튼·일주일/오늘 보지 않기 우선. register-reply에서도 사용 */
export async function closeReviewsPageModal(
  page: import("playwright").Page,
): Promise<void> {
  const tryClose = async (selector: string, timeout = 5_000): Promise<boolean> => {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout, force: true }).catch(() => {});
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  };

  const closeSelectors = [
    ".dialog-modal-wrapper button[data-testid='Dialog__CloseButton']",
    ".dialog-modal-wrapper .dialog-modal-wrapper__body--close-button",
    'div:has-text("일주일간 보지 않기")',
    'div:has-text("오늘 하루동안 보지 않기")',
    '.dialog-modal-wrapper button:has-text("닫기")',
    '.dialog-modal-wrapper button:has-text("확인")',
    '.dialog-modal-wrapper button:has-text("알겠어요")',
    '.dialog-modal-wrapper button:has-text("알겠습니다")',
  ];

  try {
    await page.waitForTimeout(800);
    let closedAny = true;
    while (closedAny) {
      closedAny = false;
      const dialog = page.locator(".dialog-modal-wrapper").first();
      if (!(await dialog.isVisible().catch(() => false))) break;
      debugLog("closeModal: dialog visible, trying close");
      for (const sel of closeSelectors) {
        if (await tryClose(sel)) {
          closedAny = true;
          debugLog("closeModal: closed with", sel.slice(0, 50));
          break;
        }
      }
      if (!closedAny) {
        const primaryBtn = dialog.locator('button[class*="primary"], button[class*="Primary"]').first();
        if (await primaryBtn.isVisible().catch(() => false)) {
          await primaryBtn.click({ timeout: 3_000, force: true }).catch(() => {});
          await page.waitForTimeout(500);
          closedAny = true;
          debugLog("closeModal: clicked primary button");
        }
      }
      if (!closedAny) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      await page.locator(".dialog-modal-wrapper").first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }
    debugLog("closeModal: no visible dialog left");
  } catch (e) {
    debugLog("closeModal: error", String(e));
  }
}

/**
 * API 직접 호출 시 403이 나므로, 리뷰 페이지에서 사용자처럼
 * "날짜 6개월 → 조회 → 다음 페이지" 클릭 후, 페이지가 보내는 API 응답을 가로채서 수집.
 */
async function fetchReviewsWithPlaywright(
  _externalStoreId: string,
  cookies: CookieItem[],
  _startDateTime: string,
  _exclusiveEndDateTime: string,
): Promise<CoupangEatsReviewItem[]> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const baseOptions: import("playwright").LaunchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  logMemory("[coupang-eats] before launch");
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({
      ...baseOptions,
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch(baseOptions);
  }
  logMemory("[coupang-eats] after launch");
  logBrowserMemory(browser as unknown, "[coupang-eats] browser");

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_USER_AGENT,
      viewport: { width: 1280, height: 720 },
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      extraHTTPHeaders: { ...BROWSER_HEADERS, Referer: REFERER },
    });

    const playCookies = cookies
      .filter(
        (c) => c.name && (c.domain?.includes("coupangeats.com") || !c.domain),
      )
      .map((c) => {
        const domain = c.domain?.trim() || ".coupangeats.com";
        const path = c.path?.trim() && c.path.startsWith("/") ? c.path : "/";
        const value =
          typeof c.value === "string"
            ? c.value.replace(/[\r\n]+/g, " ")
            : String(c.value ?? "");
        return { name: c.name.trim(), value, domain, path };
      })
      .filter((c) => c.name.length > 0);
    debugLog("playwright: cookies", { input: cookies.length, injected: playCookies.length });
    if (playCookies.length > 0) {
      await context.addCookies(playCookies);
    }

    const page = await context.newPage();
    const collected: CoupangEatsReviewItem[] = [];
    let searchResponseCount = 0;

    page.on("request", (req) => {
      if (!req.url().includes("/api/v1/merchant/reviews/search")) return;
      const postData = req.postData();
      if (DEBUG && postData) {
        try {
          const parsed = JSON.parse(postData) as Record<string, unknown>;
          debugLog("playwright: reviews/search REQUEST body", parsed);
        } catch {
          debugLog("playwright: reviews/search REQUEST body (raw)", postData.slice(0, 400));
        }
      }
    });

    page.on("response", async (response) => {
      const u = response.url();
      if (!u.includes("/api/v1/merchant/reviews/search")) return;
      searchResponseCount += 1;
      const ok = response.ok();
      if (!ok) {
        debugLog("playwright: reviews/search response", { status: response.status(), url: u });
        return;
      }
      try {
        const body = (await response.json()) as
          | CoupangEatsReviewSearchResponse
          | undefined;
        const content = Array.isArray(body?.data?.content)
          ? body.data.content
          : [];
        const total = body?.data?.total;
        debugLog("playwright: reviews/search OK", {
          responseIndex: searchResponseCount,
          contentLength: content.length,
          totalInBody: total,
        });
        if (DEBUG && (content.length === 0 || total === 0)) {
          debugLog("playwright: reviews/search response body (empty)", JSON.stringify(body).slice(0, 600));
        }
        for (const item of content) {
          collected.push(item);
        }
      } catch (e) {
        debugLog("playwright: reviews/search parse error", String(e));
      }
    });

    await page.goto(REVIEWS_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    const afterGotoUrl = page.url();
    debugLog("playwright: goto done", { url: afterGotoUrl });
    if (afterGotoUrl.includes("/login") || !afterGotoUrl.includes("reviews")) {
      debugLog("playwright: WARNING possibly not on reviews page (redirect to login?)", { url: afterGotoUrl });
    }
    await page.waitForTimeout(3_000);

    await closeReviewsPageModal(page);
    await page.waitForTimeout(2_000);

    const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
    const dateTriggerVisible = await dateTrigger.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    debugLog("playwright: date trigger", { visible: dateTriggerVisible });
    await dateTrigger.click().catch(() => {});
    await page.waitForTimeout(800);

    const sixMonths = page
      .locator('label:has-text("6개월"), input[name="quick"][value="4"]')
      .first();
    await sixMonths.click().catch(() => {});
    await page.waitForTimeout(500);

    collected.length = 0;
    searchResponseCount = 0;
    await closeReviewsPageModal(page);
    await page.waitForTimeout(1_000);
    await page.locator(".dialog-modal-wrapper").waitFor({ state: "hidden", timeout: 6_000 }).catch(() => {});
    await page.waitForTimeout(300);
    const searchBtn = page.getByRole("button", { name: "조회" });
    const searchBtnVisible = await searchBtn.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
    debugLog("playwright: search button", { visible: searchBtnVisible });
    await closeReviewsPageModal(page);
    await page.locator(".dialog-modal-wrapper").waitFor({ state: "hidden", timeout: 6_000 }).catch(() => {});
    await page.waitForTimeout(300);
    const responsePromise = page
      .waitForResponse(
        (r) => r.url().includes("/api/v1/merchant/reviews/search") && r.ok(),
        { timeout: 15_000 },
      )
      .catch((e) => {
        debugLog("playwright: waitForResponse timeout or error", String(e));
        return null;
      });
    await searchBtn.click({ force: true });
    const firstResponse = await responsePromise;
    debugLog("playwright: first search response", {
      gotResponse: !!firstResponse,
      collectedSoFar: collected.length,
    });
    await page.waitForTimeout(2_000);

    let nextClicks = 0;
    let nextBtn = page.locator("button.pagination-btn.next-btn:not(.hide-btn)");
    while (await nextBtn.isVisible().catch(() => false)) {
      nextClicks += 1;
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(2_000);
      nextBtn = page.locator("button.pagination-btn.next-btn:not(.hide-btn)");
      if (DEBUG && nextClicks <= 3) debugLog("playwright: next page", { click: nextClicks, collected: collected.length });
    }
    debugLog("playwright: pagination done", { nextClicks, totalCollected: collected.length });

    await page.waitForTimeout(1_000);

    const seen = new Set<number>();
    const deduped = collected.filter((r) => {
      if (seen.has(r.orderReviewId)) return false;
      seen.add(r.orderReviewId);
      return true;
    });
    debugLog("playwright: deduped", { before: collected.length, after: deduped.length });

    return deduped;
  } finally {
    await closeBrowserWithMemoryLog(browser, "[coupang-eats]");
  }
}
