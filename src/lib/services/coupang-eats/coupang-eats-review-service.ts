import { createServiceRoleClient } from "@/lib/db/supabase-server";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import {
  getDefaultReviewDateRange,
  getReviewSyncWindowDateRange,
  type ReviewSyncWindow,
  toYYYYMMDD,
} from "@/lib/utils/review-date-range";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_SEC_CH_UA_CHROME_146,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import * as CoupangEatsSession from "./coupang-eats-session-service";
import { listStorePlatformShopExternalIds } from "@/lib/services/platform-shop-service";

const REVIEWS_PAGE_URL =
  "https://store.coupangeats.com/merchant/management/reviews";
const REFERER = "https://store.coupangeats.com/merchant/management/reviews";
const ORDER_CONDITION_API_URL =
  "https://store.coupangeats.com/api/v1/merchant/web/order/condition";
/** 매장 홈 페이지 — 이 페이지 로드 시 발생하는 API 응답에서 매장명 캡처 (직접 호출은 403) */
const MERCHANT_HOME_URL =
  "https://store.coupangeats.com/merchant/management/home";

const BROWSER_HEADERS = {
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};
const PAGINATION_MAX_CLICKS = 200;
const PAGINATION_STAGNANT_LIMIT = 3;

/** 디버그: worker 정적 import 순서 이슈로 env를 런타임에 평가 */
const isDebugSyncEnabled = (): boolean =>
  process.env.DEBUG_COUPANG_EATS_SYNC === "1";
const isDebugStoreNameEnabled = (): boolean =>
  process.env.DEBUG_COUPANG_EATS_STORE_NAME === "1";
function debugLog(...args: unknown[]) {
  if (isDebugSyncEnabled()) console.log("[coupang-eats-sync]", ...args);
}
function debugStoreName(...args: unknown[]) {
  if (isDebugSyncEnabled() || isDebugStoreNameEnabled())
    console.log("[coupang-eats-store-name]", ...args);
}
const FORCE_REQUEST_STORE_ID =
  process.env.COUPANG_EATS_FORCE_REQUEST_STORE_ID === "1";

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

/** Cookie 배열을 Cookie 헤더 문자열로 변환 */
function toCookieHeader(cookies: CookieItem[]): string {
  return cookies
    .filter((c) => c.name && typeof c.value === "string")
    .map((c) => `${c.name}=${encodeURIComponent(String(c.value))}`)
    .join("; ");
}

/**
 * order/condition API로 매장명 조회. store_platform_sessions.store_name 저장용.
 * 실패 시 null 반환 (sync 실패로 간주하지 않음).
 */
export async function fetchCoupangEatsStoreName(
  externalShopId: string,
  cookies: CookieItem[],
): Promise<string | null> {
  const storeIdNum = Number(externalShopId);
  debugStoreName("start", {
    externalShopId,
    storeIdNum,
    cookieCount: cookies.length,
  });

  if (!Number.isInteger(storeIdNum) || storeIdNum <= 0) {
    debugStoreName("abort: invalid storeId", { externalShopId, storeIdNum });
    return null;
  }
  const { since, to } = getDefaultReviewDateRange();
  const startDate = since.getTime();
  const endDate = to.getTime();

  const body = {
    pageNumber: 0,
    pageSize: 10,
    storeId: storeIdNum,
    startDate,
    endDate,
  };
  const cookieHeader = toCookieHeader(cookies);
  if (!cookieHeader) {
    debugStoreName("abort: empty cookie header", {
      cookieCount: cookies.length,
    });
    return null;
  }

  debugStoreName("request", {
    url: ORDER_CONDITION_API_URL,
    body,
    cookieLength: cookieHeader.length,
  });

  try {
    const res = await fetch(ORDER_CONDITION_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookieHeader,
        "User-Agent": PLAYWRIGHT_AUTOMATION_USER_AGENT,
        Referer: REFERER,
        ...BROWSER_HEADERS,
      },
      body: JSON.stringify(body),
    });

    debugStoreName("response", {
      status: res.status,
      ok: res.ok,
      contentType: res.headers.get("content-type"),
    });

    if (!res.ok) {
      const text = await res.text();
      debugStoreName("order/condition API non-OK", res.status, {
        bodyPreview: text.slice(0, 500),
      });
      return null;
    }

    const raw = await res.json();
    const data = raw as {
      orderPageVo?: {
        content?: Array<{
          store?: { storeName?: string };
        }>;
      };
    };

    const content = data?.orderPageVo?.content;
    const first = content?.[0];
    const store = first?.store;
    const storeName = store?.storeName;

    debugStoreName("parsed", {
      hasOrderPageVo: !!data?.orderPageVo,
      contentLength: content?.length ?? 0,
      firstItemKeys: first ? Object.keys(first) : [],
      storeKeys: store ? Object.keys(store) : [],
      storeName: storeName ?? "(null/undefined)",
      fullBodyKeys: Object.keys(data ?? {}),
    });

    if (typeof storeName === "string" && storeName.trim()) {
      debugStoreName("ok", { store_name: storeName.trim() });
      return storeName.trim();
    }
    debugStoreName("no storeName in response", {
      sample: JSON.stringify(data).slice(0, 800),
    });
    return null;
  } catch (e) {
    debugStoreName("fetchCoupangEatsStoreName error", String(e), e);
    return null;
  }
}

/**
 * 저장된 쿠키로 Playwright 브라우저에서 리뷰 API 페이지네이션 호출 후 전체 수집.
 * sessionOverride 있으면 해당 쿠키·external_shop_id 사용 (sync 시 재로그인 후 호출용).
 */
export async function fetchAllCoupangEatsReviews(
  storeId: string,
  userId: string,
  options?: {
    sessionOverride?: CoupangEatsSessionOverride;
    /** 기본 `ongoing`(30일). 연동 직후 첫 백필은 `initial`(180일). */
    syncWindow?: ReviewSyncWindow;
    onProgress?: (progress: {
      current_shop_index: number;
      total_shops: number;
      current_platform_shop_external_id: string;
      percent: number;
      elapsed_ms: number;
      estimated_remaining_ms: number | null;
    }) => Promise<void> | void;
  },
): Promise<{
  list: CoupangEatsReviewItem[];
  total: number;
  store_name?: string;
  shop_sync_summaries?: { platform_shop_external_id: string; review_count: number }[];
}> {
  let externalStoreId: string | null;
  let cookies: CookieItem[];

  debugLog("fetchAll start", {
    storeId,
    hasSessionOverride: !!options?.sessionOverride,
  });

  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
    externalStoreId =
      options.sessionOverride.external_shop_id != null &&
      String(options.sessionOverride.external_shop_id).trim() !== ""
        ? String(options.sessionOverride.external_shop_id)
        : await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
    debugLog("sessionOverride", {
      cookieCount: cookies.length,
      external_shop_id: externalStoreId ?? "null",
    });
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

  const supabase = createServiceRoleClient();
  const syncWindow: ReviewSyncWindow = options?.syncWindow ?? "ongoing";
  const { since, to } = getReviewSyncWindowDateRange(syncWindow);
  const startDateTime = toYYYYMMDD(since);
  const exclusiveEndDateTime = toYYYYMMDD(new Date(to.getTime() + 86400000));
  debugLog("date range", { since: startDateTime, to: exclusiveEndDateTime });

  let shopIds = await listStorePlatformShopExternalIds(
    supabase,
    storeId,
    "coupang_eats",
  );
  if (shopIds.length === 0 && externalStoreId) {
    shopIds = [String(externalStoreId).trim()].filter(Boolean);
  }
  if (shopIds.length === 0) {
    throw new Error(
      "쿠팡이츠 연동 매장 목록이 없습니다. 먼저 연동을 완료해 주세요.",
    );
  }
  debugLog("shop ids for sync", {
    count: shopIds.length,
    preview: shopIds.slice(0, 12),
  });

  const { list, store_name, shop_sync_summaries } =
    await fetchReviewsWithPlaywright(
      shopIds,
      cookies,
      startDateTime,
      exclusiveEndDateTime,
      options?.onProgress,
    );

  const { data: primaryShopRow } = await supabase
    .from("store_platform_shops")
    .select("shop_name")
    .eq("store_id", storeId)
    .eq("platform", "coupang_eats")
    .eq("is_primary", true)
    .maybeSingle();
  const primaryName =
    typeof primaryShopRow?.shop_name === "string" &&
    primaryShopRow.shop_name.trim() !== ""
      ? primaryShopRow.shop_name.trim()
      : null;

  const total = list.length;
  debugLog("fetchAll done", {
    listLength: list.length,
    total,
    store_name: store_name ?? primaryName ?? "(null)",
    shops: shop_sync_summaries,
  });
  return {
    list,
    total,
    store_name: store_name ?? primaryName ?? undefined,
    shop_sync_summaries,
  };
}

/** 리뷰 페이지 모달(포장 이용 안내, 메뉴/할인 설정, 공지 등) 닫기. X 버튼·일주일/오늘 보지 않기 우선. register-reply에서도 사용 */
export async function closeReviewsPageModal(
  page: import("playwright").Page,
): Promise<void> {
  const tryClose = async (
    selector: string,
    timeout = 5_000,
  ): Promise<boolean> => {
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
        const primaryBtn = dialog
          .locator('button[class*="primary"], button[class*="Primary"]')
          .first();
        if (await primaryBtn.isVisible().catch(() => false)) {
          await primaryBtn
            .click({ timeout: 3_000, force: true })
            .catch(() => {});
          await page.waitForTimeout(500);
          closedAny = true;
          debugLog("closeModal: clicked primary button");
        }
      }
      if (!closedAny) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
      await page
        .locator(".dialog-modal-wrapper")
        .first()
        .waitFor({ state: "hidden", timeout: 5_000 })
        .catch(() => {});
    }
    debugLog("closeModal: no visible dialog left");
  } catch (e) {
    debugLog("closeModal: error", String(e));
  }
}

/**
 * API 직접 호출 시 403이 나므로, 리뷰 페이지에서 사용자처럼
 * "날짜 6개월 → 조회 → 다음 페이지" 클릭 후, 페이지가 보내는 API 응답을 가로채서 수집.
 * 매장마다 merchant/home/{platformShopId}로 컨텍스트 전환 후 동일 플로우 반복.
 */
async function fetchReviewsWithPlaywright(
  shopExternalIds: string[],
  cookies: CookieItem[],
  _startDateTime: string,
  _exclusiveEndDateTime: string,
  onProgress?: (progress: {
    current_shop_index: number;
    total_shops: number;
    current_platform_shop_external_id: string;
    percent: number;
    elapsed_ms: number;
    estimated_remaining_ms: number | null;
  }) => Promise<void> | void,
): Promise<{
  list: CoupangEatsReviewItem[];
  store_name: string | null;
  shop_sync_summaries: {
    platform_shop_external_id: string;
    review_count: number;
  }[];
}> {
  const normalized = [
    ...new Set(
      shopExternalIds
        .map((s) => String(s).trim())
        .filter((s) => s.length > 0),
    ),
  ];
  const startedAt = Date.now();
  const completedShopDurationsMs: number[] = [];
  if (normalized.length === 0) {
    throw new Error("쿠팡이츠 동기화: 수집할 매장 ID가 없습니다.");
  }
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const baseOptions: import("playwright").LaunchOptions = {
    headless: isPlaywrightHeadlessDefault(),
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
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
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
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
    debugLog("playwright: cookies", {
      input: cookies.length,
      injected: playCookies.length,
    });
    if (playCookies.length > 0) {
      await context.addCookies(playCookies);
    }

    const page = await context.newPage();
    const collected: CoupangEatsReviewItem[] = [];
    let searchResponseCount = 0;
    let activeStoreIdNum = 0;
    let collectResponsesEnabled = false;

    await page.route("**/api/v1/merchant/reviews/search**", async (route) => {
      const req = route.request();
      if (req.method() !== "POST") {
        await route.continue();
        return;
      }
      if (!FORCE_REQUEST_STORE_ID) {
        await route.continue();
        return;
      }
      const raw = req.postData();
      if (!raw) {
        await route.continue();
        return;
      }
      try {
        const body = JSON.parse(raw) as Record<string, unknown>;
        body.storeId = activeStoreIdNum;
        await route.continue({ postData: JSON.stringify(body) });
      } catch {
        await route.continue();
      }
    });

    page.on("request", (req) => {
      if (!req.url().includes("/api/v1/merchant/reviews/search")) return;
      const postData = req.postData();
      if (isDebugSyncEnabled() && postData) {
        try {
          const parsed = JSON.parse(postData) as Record<string, unknown>;
          debugLog("playwright: reviews/search REQUEST body", {
            activeStoreId: activeStoreIdNum,
            forceRequestStoreId: FORCE_REQUEST_STORE_ID,
            ...parsed,
          });
        } catch {
          debugLog(
            "playwright: reviews/search REQUEST body (raw)",
            postData.slice(0, 400),
          );
        }
      }
    });

    const onSearchResponse = async (response: import("playwright").Response) => {
      const u = response.url();
      if (!u.includes("/api/v1/merchant/reviews/search")) return;
      if (!collectResponsesEnabled) return;
      const ok = response.ok();
      if (!ok) {
        debugLog("playwright: reviews/search response", {
          status: response.status(),
          url: u,
          activeStoreId: activeStoreIdNum,
        });
        return;
      }
      try {
        const reqPostData = response.request().postData();
        let requestStoreId: number | null = null;
        if (reqPostData) {
          try {
            const parsedReq = JSON.parse(reqPostData) as { storeId?: unknown };
            const n = Number(parsedReq.storeId);
            requestStoreId = Number.isInteger(n) ? n : null;
          } catch {
            requestStoreId = null;
          }
        }
        if (requestStoreId == null) {
          const n = Number(new URL(u).searchParams.get("storeId"));
          requestStoreId = Number.isInteger(n) ? n : null;
        }
        if (requestStoreId == null || requestStoreId !== activeStoreIdNum) {
          debugLog("playwright: reviews/search response ignored(store mismatch)", {
            activeStoreId: activeStoreIdNum,
            requestStoreId,
            url: u,
          });
          return;
        }
        searchResponseCount += 1;
        const body = (await response.json()) as
          | CoupangEatsReviewSearchResponse
          | undefined;
        const content = Array.isArray(body?.data?.content)
          ? body.data.content
          : [];
        const total = body?.data?.total;
        debugLog("playwright: reviews/search OK", {
          activeStoreId: activeStoreIdNum,
          responseIndex: searchResponseCount,
          contentLength: content.length,
          totalInBody: total,
        });
        if (isDebugSyncEnabled() && (content.length === 0 || total === 0)) {
          debugLog(
            "playwright: reviews/search response body (empty)",
            JSON.stringify(body).slice(0, 600),
          );
        }
        for (const item of content) {
          collected.push({
            ...item,
            storeId: requestStoreId,
          });
        }
      } catch (e) {
        debugLog("playwright: reviews/search parse error", String(e));
      }
    };

    page.on("response", onSearchResponse);

    const shop_sync_summaries: {
      platform_shop_external_id: string;
      review_count: number;
    }[] = [];

    for (let si = 0; si < normalized.length; si++) {
      const shopId = normalized[si];
      const shopStartedAt = Date.now();
      const sidNum = Number(shopId);
      if (!Number.isInteger(sidNum) || sidNum <= 0) {
        debugLog("multi-shop: skip invalid id", { shopId });
        continue;
      }
      activeStoreIdNum = sidNum;
      searchResponseCount = 0;
      collectResponsesEnabled = false;
      const beforeLen = collected.length;
      debugLog("multi-shop: start", {
        platform_shop_external_id: shopId,
        shopIndex: si + 1,
        shopTotal: normalized.length,
      });
      await onProgress?.({
        current_shop_index: si + 1,
        total_shops: normalized.length,
        current_platform_shop_external_id: shopId,
        percent: Math.floor((si / normalized.length) * 100),
        elapsed_ms: Date.now() - startedAt,
        estimated_remaining_ms:
          completedShopDurationsMs.length > 0
            ? Math.round(
                (completedShopDurationsMs.reduce((a, b) => a + b, 0) /
                  completedShopDurationsMs.length) *
                  (normalized.length - si),
              )
            : null,
      });

      const reviewsUrlByShop = `${REVIEWS_PAGE_URL}/${shopId}`;
      await page.goto(reviewsUrlByShop, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      const afterGotoUrl = page.url();
      debugLog("playwright: goto done", {
        shopId,
        url: afterGotoUrl,
        expectedUrl: reviewsUrlByShop,
      });
      if (afterGotoUrl.includes("/login") || !afterGotoUrl.includes("reviews")) {
        throw new Error(
          "쿠팡이츠 세션이 만료되었습니다. 로그인 페이지로 리다이렉트되었습니다.",
        );
      }
      if (!afterGotoUrl.includes(`/reviews/${shopId}`)) {
        debugLog("playwright: shop context mismatch after goto", {
          shopId,
          url: afterGotoUrl,
        });
      }
      await page.waitForTimeout(1_500);

      await closeReviewsPageModal(page);
      await page.waitForTimeout(1_200);

      const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
      const dateTriggerVisible = await dateTrigger
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      debugLog("playwright: date trigger", {
        shopId,
        visible: dateTriggerVisible,
      });
      if (!dateTriggerVisible) {
        throw new Error(
          "쿠팡이츠 리뷰 페이지가 로드되지 않았습니다. 세션 만료이거나 레이아웃이 변경되었을 수 있습니다.",
        );
      }
      await dateTrigger.click().catch(() => {});
      await page.waitForTimeout(800);

      const sixMonths = page
        .locator('label:has-text("6개월"), input[name="quick"][value="4"]')
        .first();
      await sixMonths.click().catch(() => {});
      await page.waitForTimeout(500);

      await closeReviewsPageModal(page);
      await page.waitForTimeout(1_000);
      await page
        .locator(".dialog-modal-wrapper")
        .waitFor({ state: "hidden", timeout: 6_000 })
        .catch(() => {});
      await page.waitForTimeout(300);
      const searchBtn = page.getByRole("button", { name: "조회" });
      const searchBtnVisible = await searchBtn
        .waitFor({ state: "visible", timeout: 5_000 })
        .then(() => true)
        .catch(() => false);
      debugLog("playwright: search button", {
        shopId,
        visible: searchBtnVisible,
      });
      if (!searchBtnVisible) {
        throw new Error(
          "쿠팡이츠 리뷰 페이지에서 '조회' 버튼을 찾을 수 없습니다. 세션 만료이거나 페이지가 완전히 로드되지 않았을 수 있습니다.",
        );
      }
      await closeReviewsPageModal(page);
      await page
        .locator(".dialog-modal-wrapper")
        .waitFor({ state: "hidden", timeout: 4_000 })
        .catch(() => {});
      await page.waitForTimeout(200);
      const responsePromise = page
        .waitForResponse(
          (r) => {
            if (!r.url().includes("/api/v1/merchant/reviews/search") || !r.ok()) {
              return false;
            }
            const postData = r.request().postData();
            if (postData) {
              try {
                const body = JSON.parse(postData) as { storeId?: unknown };
                return Number(body.storeId) === sidNum;
              } catch {
                return false;
              }
            }
            const n = Number(new URL(r.url()).searchParams.get("storeId"));
            return Number.isInteger(n) && n === sidNum;
          },
          { timeout: 10_000 },
        )
        .catch((e) => {
          debugLog("playwright: waitForResponse timeout or error", String(e));
          return null;
        });
      collectResponsesEnabled = true;
      await searchBtn.click({ force: true });
      const firstResponse = await responsePromise;
      debugLog("playwright: first search response", {
        shopId,
        gotResponse: !!firstResponse,
        collectedSoFar: collected.length,
      });
      await page.waitForTimeout(2_000);

      let nextClicks = 0;
      let stagnantRounds = 0;
      let nextBtn = page.locator(
        "button.pagination-btn.next-btn:not(.hide-btn)",
      );
      while (await nextBtn.isVisible().catch(() => false)) {
        if (nextClicks >= PAGINATION_MAX_CLICKS) {
          debugLog("playwright: pagination safety break(max clicks)", {
            shopId,
            nextClicks,
            totalCollected: collected.length,
          });
          break;
        }
        const beforePageCount = collected.length;
        nextClicks += 1;
        await nextBtn.click().catch(() => {});
        await page.waitForTimeout(2_000);
        nextBtn = page.locator(
          "button.pagination-btn.next-btn:not(.hide-btn)",
        );
        if (collected.length <= beforePageCount) stagnantRounds += 1;
        else stagnantRounds = 0;
        if (stagnantRounds >= PAGINATION_STAGNANT_LIMIT) {
          debugLog("playwright: pagination safety break(stagnant)", {
            shopId,
            nextClicks,
            stagnantRounds,
            totalCollected: collected.length,
          });
          break;
        }
        if (isDebugSyncEnabled() && nextClicks <= 3)
          debugLog("playwright: next page", {
            shopId,
            click: nextClicks,
            collected: collected.length,
          });
      }
      debugLog("playwright: pagination done", {
        shopId,
        nextClicks,
        totalCollected: collected.length,
      });
      collectResponsesEnabled = false;
      await page.waitForTimeout(500);

      const added = collected.length - beforeLen;
      completedShopDurationsMs.push(Date.now() - shopStartedAt);
      shop_sync_summaries.push({
        platform_shop_external_id: shopId,
        review_count: added,
      });
      debugLog("multi-shop: done", {
        platform_shop_external_id: shopId,
        review_count: added,
      });
      await onProgress?.({
        current_shop_index: si + 1,
        total_shops: normalized.length,
        current_platform_shop_external_id: shopId,
        percent: Math.floor(((si + 1) / normalized.length) * 100),
        elapsed_ms: Date.now() - startedAt,
        estimated_remaining_ms:
          completedShopDurationsMs.length > 0
            ? Math.round(
                (completedShopDurationsMs.reduce((a, b) => a + b, 0) /
                  completedShopDurationsMs.length) *
                  (normalized.length - (si + 1)),
              )
            : null,
      });
    }

    page.off("response", onSearchResponse);

    const seen = new Set<string>();
    const deduped = collected.filter((r) => {
      const key = `${r.storeId ?? 0}-${r.orderReviewId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    debugLog("playwright: deduped", {
      before: collected.length,
      after: deduped.length,
    });

    let store_name: string | null = null;
    const primaryShopId = normalized[0];
    const storeIdNum = Number(primaryShopId);
    if (Number.isInteger(storeIdNum) && storeIdNum > 0) {
      try {
        let resolveCapture: (name: string | null) => void;
        const capturePromise = new Promise<string | null>((resolve) => {
          resolveCapture = resolve;
        });
        let captured = false;
        const captureListener = async (
          response: import("playwright").Response,
        ) => {
          if (captured) return;
          const url = response.url();
          if (!url.includes("merchant/web/stores") || !response.ok()) return;
          captured = true;
          try {
            const body = (await response.json()) as {
              data?:
                | Array<{ name?: string; id?: number }>
                | { id?: number; name?: string };
            };
            let name: string | null = null;
            const raw = body?.data;
            if (Array.isArray(raw)) {
              const matched = raw.find((row) => row?.id === storeIdNum);
              const target = matched ?? raw[0];
              name =
                typeof target?.name === "string" && target.name.trim()
                  ? target.name.trim()
                  : null;
            } else if (raw && typeof raw === "object") {
              const obj = raw as { id?: number; name?: string };
              if (
                obj.id === storeIdNum &&
                typeof obj.name === "string" &&
                obj.name.trim()
              ) {
                name = obj.name.trim();
              } else if (
                typeof obj.name === "string" &&
                obj.name.trim() &&
                (obj.id == null || obj.id === storeIdNum)
              ) {
                name = obj.name.trim();
              }
            }
            debugStoreName("playwright stores API captured", {
              url,
              targetStoreId: storeIdNum,
              name: name ?? "(null)",
            });
            resolveCapture(name);
          } catch {
            resolveCapture(null);
          }
        };
        page.on("response", captureListener);
        const homeUrl = `${MERCHANT_HOME_URL}/${primaryShopId}`;
        debugStoreName("playwright goto home for store_name", { homeUrl });
        await page.goto(homeUrl, {
          waitUntil: "domcontentloaded",
          timeout: 15_000,
        });
        store_name = await Promise.race([
          capturePromise,
          new Promise<null>((resolve) => {
            setTimeout(() => {
              debugStoreName("playwright home: no stores response in time");
              resolve(null);
            }, 8_000);
          }),
        ]);
        page.off("response", captureListener);
        debugStoreName("playwright home capture", {
          store_name: store_name ?? "(null)",
        });
      } catch (e) {
        debugStoreName("playwright home capture error", String(e));
      }
    }

    return { list: deduped, store_name, shop_sync_summaries };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[coupang-eats]");
  }
}
