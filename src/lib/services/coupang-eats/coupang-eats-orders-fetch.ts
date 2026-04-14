/**
 * 쿠팡이츠 셀러웹 `POST /api/v1/merchant/web/order/condition` — 매장(`storeId`)·기간·페이지별 주문 목록.
 * 계정 전체를 한 번에 조회할 수 없어, `store_platform_shops`의 coupang_eats 점포마다 호출한다.
 */
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_SEC_CH_UA_CHROME_146,
} from "@/lib/config/playwright-defaults";
import { kstYmdBoundsUtc } from "@/lib/utils/kst-date";
import { platformOrdersDateRangeInclusiveKst } from "@/lib/utils/kst-date";

export const COUPANG_EATS_ORDER_CONDITION_URL =
  "https://store.coupangeats.com/api/v1/merchant/web/order/condition" as const;

/** `x-request-meta` JSON 필드 `r` — DevTools 캡처상 주문 API 호출에도 로그인 URL */
export const COUPANG_EATS_X_META_R_DEFAULT =
  "https://store.coupangeats.com/merchant/login" as const;

/** @deprecated `PLAYWRIGHT_AUTOMATION_USER_AGENT`와 동일 — 호환용 별칭 */
export const COUPANG_EATS_BROWSER_USER_AGENT = PLAYWRIGHT_AUTOMATION_USER_AGENT;

const BROWSER_HEADERS = {
  /** 실제 브라우저 캡처는 `ko-KR` 단일인 경우가 많음 */
  "Accept-Language": "ko-KR",
  "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
} as const;

/**
 * 셀러웹 XHR이 붙이는 `x-request-meta` (Base64 UTF-8 JSON).
 * 없으면 Akamai에서 403 HTML만 돌아오는 경우가 있음.
 */
export function buildCoupangEatsXRequestMetaB64(args: {
  /** JSON `r` — HTTP Referer와 별개; 캡처는 로그인 URL */
  metaR?: string;
  userAgent: string;
  viewportWidth: number;
  viewportHeight: number;
  locale?: string;
  /** 기본 `Date.now()` — 호출마다 갱신 */
  timestampMs?: number;
}): string {
  const payload = {
    o: "https://store.coupangeats.com",
    ua: args.userAgent,
    r: args.metaR ?? COUPANG_EATS_X_META_R_DEFAULT,
    t: args.timestampMs ?? Date.now(),
    sr: `${Math.round(args.viewportWidth)}x${Math.round(args.viewportHeight)}`,
    l: args.locale ?? "ko-KR",
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/** Node fetch / in-page fetch 공통 헤더(매 호출마다 새 `x-request-meta`의 `t`) */
export function coupangEatsOrderConditionRequestHeaders(
  refererStoreId: number,
  options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    metaR?: string;
  },
) {
  const referer = `https://store.coupangeats.com/merchant/management/orders/${refererStoreId}`;
  const vw = options?.viewportWidth ?? PLAYWRIGHT_DEFAULT_VIEWPORT.width;
  const vh = options?.viewportHeight ?? PLAYWRIGHT_DEFAULT_VIEWPORT.height;
  const xMeta = buildCoupangEatsXRequestMetaB64({
    metaR: options?.metaR,
    userAgent: COUPANG_EATS_BROWSER_USER_AGENT,
    viewportWidth: vw,
    viewportHeight: vh,
  });
  return {
    "Content-Type": "application/json;charset=UTF-8",
    Accept: "application/json",
    Referer: referer,
    Origin: "https://store.coupangeats.com",
    "X-Requested-With": "XMLHttpRequest",
    "x-request-meta": xMeta,
    ...BROWSER_HEADERS,
  } as const;
}

/** KST 닫힌 일자 구간 → API `startDate`/`endDate` (epoch ms, 일 끝 포함) */
export function coupangEatsOrderConditionMsRangeFromKstYmd(args: {
  startYmd: string;
  endYmd: string;
}): { startDate: number; endDate: number } {
  const startDate = kstYmdBoundsUtc(args.startYmd, false).getTime();
  const endDate = kstYmdBoundsUtc(args.endYmd, true).getTime();
  return { startDate, endDate };
}

export function coupangEatsOrdersDateRangeLastDays(
  inclusiveDays: number,
  now: Date = new Date(),
): { startYmd: string; endYmd: string; startDate: number; endDate: number } {
  const { startYmd, endYmd } = platformOrdersDateRangeInclusiveKst(inclusiveDays, now);
  const { startDate, endDate } = coupangEatsOrderConditionMsRangeFromKstYmd({
    startYmd,
    endYmd,
  });
  return { startYmd, endYmd, startDate, endDate };
}

export type CoupangEatsOrderConditionItem = {
  orderId?: number;
  uniqueOrderId?: string;
  abbrOrderId?: string;
  storeId?: number;
  totalAmount?: number;
  salePrice?: number;
  actuallyAmount?: number;
  createdAt?: number;
  status?: string;
  type?: string;
  testOrder?: boolean;
  items?: unknown;
  store?: { storeName?: string; storeId?: number };
  [key: string]: unknown;
};

export type CoupangEatsOrderConditionPage = {
  content: CoupangEatsOrderConditionItem[];
  pageNumber: number;
  totalElements: number;
  /** 페이지 내 행 수(일부 응답) */
  total?: number;
};

export type CoupangEatsOrderConditionResponse = {
  orderPageVo?: CoupangEatsOrderConditionPage;
  code?: string;
  error?: unknown;
};

export class CoupangEatsOrdersFetchError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly bodySnippet?: string,
  ) {
    super(message);
    this.name = "CoupangEatsOrdersFetchError";
  }
}

/**
 * 단일 매장·단일 페이지 조회.
 */
export async function fetchCoupangEatsOrderConditionPage(args: {
  cookieHeader: string;
  storeId: number;
  startDate: number;
  endDate: number;
  pageNumber: number;
  pageSize: number;
  refererStoreId?: number;
}): Promise<CoupangEatsOrderConditionResponse> {
  const {
    cookieHeader,
    storeId,
    startDate,
    endDate,
    pageNumber,
    pageSize,
    refererStoreId,
  } = args;
  const refId = refererStoreId ?? storeId;

  const orderHeaders = {
    ...coupangEatsOrderConditionRequestHeaders(refId),
    Cookie: cookieHeader,
    "User-Agent": COUPANG_EATS_BROWSER_USER_AGENT,
  };
  if (process.env.DEBUG_COUPANG_EATS_ORDER_FETCH === "1") {
    const meta = orderHeaders["x-request-meta"];
    console.log(
      "[coupang_eats_order_fetch] node request x-request-meta:",
      meta ? `present len=${meta.length} prefix=${meta.slice(0, 28)}…` : "MISSING",
    );
  }

  const res = await fetch(COUPANG_EATS_ORDER_CONDITION_URL, {
    method: "POST",
    headers: orderHeaders,
    body: JSON.stringify({
      pageNumber,
      pageSize,
      storeId,
      startDate,
      endDate,
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new CoupangEatsOrdersFetchError(
      `order/condition HTTP ${res.status}`,
      res.status,
      text.slice(0, 400),
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new CoupangEatsOrdersFetchError(
      "order/condition JSON 파싱 실패",
      res.status,
      text.slice(0, 400),
    );
  }

  return raw as CoupangEatsOrderConditionResponse;
}

export type CoupangEatsOrdersFetchForStoreResult = {
  storeId: number;
  orders: CoupangEatsOrderConditionItem[];
  fetched_pages: number;
  total_elements: number;
};

/** 셀러웹·리뷰 쪽 order/condition 호출과 동일(서버가 더 크게 허용해도 안전한 쪽) */
export const COUPANG_EATS_ORDER_CONDITION_PAGE_SIZE_DEFAULT = 10;
const DEFAULT_PAGE_SIZE = COUPANG_EATS_ORDER_CONDITION_PAGE_SIZE_DEFAULT;

/**
 * 한 매장에 대해 기간 내 전 페이지 수집.
 */
export async function fetchCoupangEatsOrdersAllPagesForStore(args: {
  cookieHeader: string;
  storeId: number;
  startDate: number;
  endDate: number;
  pageSize?: number;
  /** 페이지 사이 간격 ms */
  delayMsBetweenPages?: number;
}): Promise<CoupangEatsOrdersFetchForStoreResult> {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE;
  const delay = args.delayMsBetweenPages ?? 150;
  const orders: CoupangEatsOrderConditionItem[] = [];
  let pageNumber = 0;
  let totalElements = 0;
  let fetchedPages = 0;

  for (;;) {
    const json = await fetchCoupangEatsOrderConditionPage({
      cookieHeader: args.cookieHeader,
      storeId: args.storeId,
      startDate: args.startDate,
      endDate: args.endDate,
      pageNumber,
      pageSize,
      refererStoreId: args.storeId,
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
