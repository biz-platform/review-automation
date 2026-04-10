/**
 * 요기요 사장님 주문내역 API (`POST /proxy/orders/`) — 대시보드 연동 전 단독 사용·스크립트용.
 * @see https://ceo-api.yogiyo.co.kr/proxy/orders/
 */
import { platformOrdersDateRangeInclusiveKst } from "@/lib/utils/kst-date";

const API_BASE = "https://ceo-api.yogiyo.co.kr";
export const YOGIYO_PROXY_ORDERS_URL = `${API_BASE}/proxy/orders/`;
export const YOGIYO_ORDERS_PAGE_SIZE = 10;

const REQUEST_HEADERS: Record<string, string> = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Content-Type": "application/json",
  Origin: "https://ceo.yogiyo.co.kr",
  Referer: "https://ceo.yogiyo.co.kr/",
};

/** 브라우저에서 캡처한 요청과 동일한 필터 */
export const YOGIYO_ORDERS_DEFAULT_ORDER_STATUSES = [
  "SUCCESS",
  "CANCELLED",
] as const;
export const YOGIYO_ORDERS_DEFAULT_CENTRAL_PAYMENT_TYPES = [
  "OFFLINE_CARD",
  "OFFLINE_CASH",
  "ONLINE",
] as const;
export const YOGIYO_ORDERS_DEFAULT_PURCHASE_SERVING_TYPES = [
  "DELIVERY",
  "TAKEOUT",
  "PREVISIT",
] as const;

export type YogiyoOrdersProxyRequestBody = {
  date_from: string;
  date_to: string;
  restaurant_ids: number[];
  order_statuses: string[];
  central_payment_types: string[];
  purchase_serving_types: string[];
  page: number;
};

export type YogiyoOrderProxyItem = {
  order_number: string;
  service_type?: string;
  purchase_serving_type?: string;
  restaurant_id: number;
  restaurant_name?: string;
  items?: {
    name: string;
    quantity: number;
    item_type?: string | null;
  }[];
  order_price?: number;
  delivery_fee?: number;
  extra_payment_price?: number;
  items_price?: number;
  central_payment_type?: string;
  delivery_method_code?: string | null;
  delivery_serving_type?: string | null;
  address?: {
    street_name?: string;
    road_name?: string;
    street_number?: string;
  };
  transmission_status?: string;
  is_no_show?: boolean;
  submitted_at?: string;
};

export type YogiyoOrdersProxyResponse = {
  count: number | null;
  orders_price: number | null;
  summary_by_order_status: unknown;
  orders: YogiyoOrderProxyItem[];
};

/** KST 기준 오늘 포함 `days`일 — 배민·땡겨요와 동일 {@link platformOrdersDateRangeInclusiveKst} */
export function yogiyoOrdersDateRangeLastDays(
  days: number,
  now: Date = new Date(),
): { date_from: string; date_to: string } {
  const { startYmd, endYmd } = platformOrdersDateRangeInclusiveKst(days, now);
  return { date_from: startYmd, date_to: endYmd };
}

export function buildYogiyoOrdersProxyBody(
  params: {
    date_from: string;
    date_to: string;
    restaurant_ids: number[];
    page: number;
    order_statuses?: readonly string[];
    central_payment_types?: readonly string[];
    purchase_serving_types?: readonly string[];
  },
): YogiyoOrdersProxyRequestBody {
  return {
    date_from: params.date_from,
    date_to: params.date_to,
    restaurant_ids: params.restaurant_ids,
    order_statuses: [...(params.order_statuses ?? YOGIYO_ORDERS_DEFAULT_ORDER_STATUSES)],
    central_payment_types: [
      ...(params.central_payment_types ?? YOGIYO_ORDERS_DEFAULT_CENTRAL_PAYMENT_TYPES),
    ],
    purchase_serving_types: [
      ...(params.purchase_serving_types ?? YOGIYO_ORDERS_DEFAULT_PURCHASE_SERVING_TYPES),
    ],
    page: params.page,
  };
}

/**
 * 단일 페이지 POST. 첫 페이지에서만 `count` 등 요약이 채워지는 경우가 있음.
 */
export async function fetchYogiyoOrdersProxyPage(
  bearerToken: string,
  body: YogiyoOrdersProxyRequestBody,
): Promise<YogiyoOrdersProxyResponse> {
  const res = await fetch(YOGIYO_PROXY_ORDERS_URL, {
    method: "POST",
    headers: {
      ...REQUEST_HEADERS,
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `yogiyo proxy/orders HTTP ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(text) as YogiyoOrdersProxyResponse;
}

/**
 * `proxy/orders` 401 + 토큰 만료 응답 → 저장 계정으로 재로그인(`refreshYogiyoSession`) 후 1회 재시도할 때만 true.
 * (다른 401은 재시도로 해결 안 되는 경우가 많아 제외)
 */
export function isYogiyoOrdersProxyTokenExpiredError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message;
  if (!msg.includes("yogiyo proxy/orders HTTP 401")) return false;
  return (
    msg.includes("token_expired") ||
    msg.includes("Signature has expired") ||
    msg.includes('"code":"token_expired"')
  );
}

function totalPagesFromCount(count: number): number {
  if (count <= 0) return 1;
  return Math.ceil(count / YOGIYO_ORDERS_PAGE_SIZE);
}

export type FetchYogiyoOrdersForRestaurantResult = {
  restaurant_id: number;
  date_from: string;
  date_to: string;
  total_count_from_first_page: number | null;
  fetched_pages: number;
  orders: YogiyoOrderProxyItem[];
  first_page_summary: Pick<
    YogiyoOrdersProxyResponse,
    "orders_price" | "summary_by_order_status"
  > | null;
};

/**
 * 한 매장(`restaurant_id`)에 대해 기간 내 전 페이지 수집.
 * 첫 응답의 `count`로 `ceil(count/10)` 페이지까지 요청.
 */
export async function fetchYogiyoOrdersAllPagesForRestaurant(
  bearerToken: string,
  restaurantId: number,
  dateFrom: string,
  dateTo: string,
  options?: {
    /** 페이지 사이 지연(ms) */
    delayMsBetweenPages?: number;
  },
): Promise<FetchYogiyoOrdersForRestaurantResult> {
  const delay = options?.delayMsBetweenPages ?? 120;
  const base = {
    date_from: dateFrom,
    date_to: dateTo,
    restaurant_ids: [restaurantId],
  };

  const firstBody = buildYogiyoOrdersProxyBody({ ...base, page: 1 });
  const first = await fetchYogiyoOrdersProxyPage(bearerToken, firstBody);
  const totalCount =
    typeof first.count === "number" && Number.isFinite(first.count)
      ? first.count
      : null;

  const orders: YogiyoOrderProxyItem[] = [...(first.orders ?? [])];
  let fetchedPages = 1;

  if (totalCount != null) {
    const lastPage = totalPagesFromCount(totalCount);
    for (let page = 2; page <= lastPage; page++) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const body = buildYogiyoOrdersProxyBody({ ...base, page });
      const next = await fetchYogiyoOrdersProxyPage(bearerToken, body);
      orders.push(...(next.orders ?? []));
      fetchedPages = page;
    }
  } else {
    let lastLen = (first.orders ?? []).length;
    for (let page = 2; lastLen === YOGIYO_ORDERS_PAGE_SIZE && page <= 5000; page++) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      const body = buildYogiyoOrdersProxyBody({ ...base, page });
      const next = await fetchYogiyoOrdersProxyPage(bearerToken, body);
      const chunk = next.orders ?? [];
      orders.push(...chunk);
      fetchedPages = page;
      lastLen = chunk.length;
      if (chunk.length === 0 || chunk.length < YOGIYO_ORDERS_PAGE_SIZE) break;
    }
  }

  return {
    restaurant_id: restaurantId,
    date_from: dateFrom,
    date_to: dateTo,
    total_count_from_first_page: totalCount,
    fetched_pages: fetchedPages,
    orders,
    first_page_summary: {
      orders_price: first.orders_price,
      summary_by_order_status: first.summary_by_order_status,
    },
  };
}

export type FetchYogiyoOrdersForRestaurantsResult = {
  range: { date_from: string; date_to: string };
  per_restaurant: FetchYogiyoOrdersForRestaurantResult[];
  /** 전체 주문 건수(매장별 합) */
  total_order_rows: number;
};

/**
 * 샵인샵 다중 매장: `restaurant_ids` 순회하며 각각 60일(또는 인자 기간) 전량 수집.
 */
export async function fetchYogiyoOrdersAllPagesForRestaurants(
  bearerToken: string,
  restaurantIds: number[],
  dateFrom: string,
  dateTo: string,
  options?: { delayMsBetweenPages?: number; delayMsBetweenRestaurants?: number },
): Promise<FetchYogiyoOrdersForRestaurantsResult> {
  const per: FetchYogiyoOrdersForRestaurantResult[] = [];
  const between = options?.delayMsBetweenRestaurants ?? 200;
  for (let i = 0; i < restaurantIds.length; i++) {
    if (i > 0 && between > 0) await new Promise((r) => setTimeout(r, between));
    const id = restaurantIds[i];
    const one = await fetchYogiyoOrdersAllPagesForRestaurant(
      bearerToken,
      id,
      dateFrom,
      dateTo,
      { delayMsBetweenPages: options?.delayMsBetweenPages },
    );
    per.push(one);
  }
  const total_order_rows = per.reduce((s, x) => s + x.orders.length, 0);
  return {
    range: { date_from: dateFrom, date_to: dateTo },
    per_restaurant: per,
    total_order_rows,
  };
}
