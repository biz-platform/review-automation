/**
 * 쿠팡이츠 order/condition — Node `fetch`·Playwright `page.request`는 Akamai 403이 자주 난다.
 * 리뷰 동기화(`coupang-eats-review-service`)와 같이 **문서 origin에서 `fetch`(credentials: include)** 로 호출한다.
 */
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_GOTO_DOMCONTENTLOADED_TIMEOUT_MS,
  PLAYWRIGHT_SEC_CH_UA_CHROME_146,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import {
  buildCoupangEatsXRequestMetaB64,
  COUPANG_EATS_BROWSER_USER_AGENT,
  COUPANG_EATS_ORDER_CONDITION_PAGE_SIZE_DEFAULT,
  COUPANG_EATS_ORDER_CONDITION_URL,
  type CoupangEatsOrderConditionItem,
  type CoupangEatsOrderConditionResponse,
  CoupangEatsOrdersFetchError,
} from "@/lib/services/coupang-eats/coupang-eats-orders-fetch";

type PlaywrightAddCookie = Parameters<
  import("playwright").BrowserContext["addCookies"]
>[0][number];

/** `fetchReviewsWithPlaywright`와 동일 규칙 — 도메인 누락 시 `.coupangeats.com` */
function cookieItemsToPlaywrightCookies(cookies: CookieItem[]): PlaywrightAddCookie[] {
  return cookies
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
}

type OrderConditionEvaluatePayload = {
  url: string;
  pageNumber: number;
  pageSize: number;
  storeId: number;
  startDate: number;
  endDate: number;
  xRequestMeta: string;
};

/**
 * 현재 페이지(주문 목록)와 동일 origin에서 XHR과 동일한 `fetch` + `x-request-meta`.
 */
async function fetchCoupangEatsOrderConditionPageInPage(
  page: import("playwright").Page,
  args: {
    storeId: number;
    startDate: number;
    endDate: number;
    pageNumber: number;
    pageSize: number;
  },
): Promise<CoupangEatsOrderConditionResponse> {
  const vp = page.viewportSize();
  const xRequestMeta = buildCoupangEatsXRequestMetaB64({
    userAgent: COUPANG_EATS_BROWSER_USER_AGENT,
    viewportWidth: vp?.width ?? PLAYWRIGHT_DEFAULT_VIEWPORT.width,
    viewportHeight: vp?.height ?? PLAYWRIGHT_DEFAULT_VIEWPORT.height,
  });

  const payload: OrderConditionEvaluatePayload = {
    url: COUPANG_EATS_ORDER_CONDITION_URL,
    pageNumber: args.pageNumber,
    pageSize: args.pageSize,
    storeId: args.storeId,
    startDate: args.startDate,
    endDate: args.endDate,
    xRequestMeta,
  };

  const evaluated = await page.evaluate(
    async (p: OrderConditionEvaluatePayload) => {
      const r = await fetch(p.url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json;charset=UTF-8",
          Accept: "application/json",
          "Accept-Language": "ko-KR",
          "X-Requested-With": "XMLHttpRequest",
          "x-request-meta": p.xRequestMeta,
          "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
        },
        body: JSON.stringify({
          pageNumber: p.pageNumber,
          pageSize: p.pageSize,
          storeId: p.storeId,
          startDate: p.startDate,
          endDate: p.endDate,
        }),
      });
      const text = await r.text();
      return { status: r.status, ok: r.ok, text };
    },
    payload,
  );

  if (!evaluated.ok) {
    throw new CoupangEatsOrdersFetchError(
      `order/condition HTTP ${evaluated.status}`,
      evaluated.status,
      evaluated.text.slice(0, 400),
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(evaluated.text) as unknown;
  } catch {
    throw new CoupangEatsOrdersFetchError(
      "order/condition JSON 파싱 실패",
      evaluated.status,
      evaluated.text.slice(0, 400),
    );
  }

  return raw as CoupangEatsOrderConditionResponse;
}

async function fetchCoupangEatsOrdersAllPagesForStorePlaywrightPage(args: {
  page: import("playwright").Page;
  storeId: number;
  startDate: number;
  endDate: number;
  pageSize?: number;
  delayMsBetweenPages?: number;
}): Promise<{
  storeId: number;
  orders: CoupangEatsOrderConditionItem[];
  fetched_pages: number;
  total_elements: number;
}> {
  const pageSize = args.pageSize ?? COUPANG_EATS_ORDER_CONDITION_PAGE_SIZE_DEFAULT;
  const delay = args.delayMsBetweenPages ?? 150;
  const orders: CoupangEatsOrderConditionItem[] = [];
  let pageNumber = 0;
  let totalElements = 0;
  let fetchedPages = 0;

  const refererUrl = `https://store.coupangeats.com/merchant/management/orders/${args.storeId}`;
  await args.page.goto(refererUrl, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_GOTO_DOMCONTENTLOADED_TIMEOUT_MS,
  });
  if (
    args.page.url().includes("/merchant/login") ||
    !args.page.url().includes("/merchant/management/orders/")
  ) {
    throw new Error(
      "쿠팡이츠 주문 동기화: 세션 만료 또는 주문 페이지 진입 실패(로그인 리다이렉트).",
    );
  }
  await args.page.waitForTimeout(400);

  for (;;) {
    const json = await fetchCoupangEatsOrderConditionPageInPage(args.page, {
      storeId: args.storeId,
      startDate: args.startDate,
      endDate: args.endDate,
      pageNumber,
      pageSize,
    });

    const vo = json.orderPageVo;
    const content = Array.isArray(vo?.content) ? vo!.content : [];
    if (pageNumber === 0 && typeof vo?.totalElements === "number" && vo.totalElements >= 0) {
      totalElements = vo.totalElements;
    }

    fetchedPages += 1;
    orders.push(...content);

    if (content.length === 0) break;
    if (orders.length >= totalElements && totalElements > 0) break;
    if (content.length < pageSize) break;

    pageNumber += 1;
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  }

  return {
    storeId: args.storeId,
    orders,
    fetched_pages: fetchedPages,
    total_elements: totalElements,
  };
}

export type CoupangEatsOrdersAllShopsPlaywrightResult = {
  perShop: {
    platform_shop_external_id: string;
    rows: number;
    fetched_pages: number;
    total_elements: number;
  }[];
  allRows: CoupangEatsOrderConditionItem[];
};

/**
 * 한 브라우저 세션으로 `shopExternalIds` 전부 순회 (매장마다 주문 목록 페이지로 이동 후 API).
 */
export async function fetchCoupangEatsOrdersAllShopsPlaywright(args: {
  cookies: CookieItem[];
  shopExternalIds: string[];
  startDate: number;
  endDate: number;
  delayMsBetweenPages?: number;
}): Promise<CoupangEatsOrdersAllShopsPlaywrightResult> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. pnpm add playwright 후 npx playwright install chromium",
    );
  }

  const baseLaunch: import("playwright").LaunchOptions = {
    headless: isPlaywrightHeadlessDefault(),
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };

  const extraHeaders = {
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
  } as const;

  let browser: import("playwright").Browser | undefined;
  try {
    try {
      browser = await playwright.chromium.launch({
        ...baseLaunch,
        channel: "chrome",
      });
    } catch {
      browser = await playwright.chromium.launch(baseLaunch);
    }

    const context = await browser.newContext({
      userAgent: COUPANG_EATS_BROWSER_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        ...extraHeaders,
        Referer: "https://store.coupangeats.com/merchant/management",
      },
    });

    const playCookies = cookieItemsToPlaywrightCookies(args.cookies);
    if (playCookies.length > 0) {
      await context.addCookies(playCookies);
    }
    const page = await context.newPage();

    const perShop: CoupangEatsOrdersAllShopsPlaywrightResult["perShop"] = [];
    const allRows: CoupangEatsOrderConditionItem[] = [];

    for (const ext of args.shopExternalIds) {
      const storeIdNum = Number(ext);
      if (!Number.isInteger(storeIdNum) || storeIdNum <= 0) {
        console.warn("[coupang_eats_orders_sync:pw] skip invalid shop id", ext);
        continue;
      }
      const one = await fetchCoupangEatsOrdersAllPagesForStorePlaywrightPage({
        page,
        storeId: storeIdNum,
        startDate: args.startDate,
        endDate: args.endDate,
        delayMsBetweenPages: args.delayMsBetweenPages ?? 180,
      });
      allRows.push(...one.orders);
      perShop.push({
        platform_shop_external_id: ext,
        rows: one.orders.length,
        fetched_pages: one.fetched_pages,
        total_elements: one.total_elements,
      });
    }

    return { perShop, allRows };
  } finally {
    await browser?.close();
  }
}
