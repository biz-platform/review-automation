/**
 * 요기요 정산 내역 API (`GET /proxy/billyo/settlement/{biz_no}/`)
 * - 정산(입금) 구간과 입금액(deposit_amount) 제공
 * - 주문 원장(매출)과 별개로 순액/정산금액 계산에 사용
 */
const API_BASE = "https://ceo-api.yogiyo.co.kr";

export const YOGIYO_BILLYO_SETTLEMENT_URL = (bizNoWithHyphens: string) =>
  `${API_BASE}/proxy/billyo/settlement/${encodeURIComponent(bizNoWithHyphens)}/`;

export type YogiyoSettlementRow = {
  id: number;
  deposit_date: string;
  deposit_status: string;
  settlement_start_date: string;
  settlement_end_date: string;
  deposit_amount: number;
  contract_type?: string | null;
};

export type YogiyoSettlementResponse = {
  rows: YogiyoSettlementRow[];
  row_count: number | null;
  total_deposit_amount?: number | null;
  total_discount_amount?: number | null;
  settlement_start_date?: string | null;
  settlement_end_date?: string | null;
  [key: string]: unknown;
};

type FetchParams = {
  bearerToken: string;
  bizNoWithHyphens: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  page_size?: number;
  page?: number;
};

export async function fetchYogiyoSettlementPage(
  params: FetchParams,
): Promise<YogiyoSettlementResponse> {
  const page_size = params.page_size ?? 50;
  const page = params.page ?? 1;

  const url = new URL(YOGIYO_BILLYO_SETTLEMENT_URL(params.bizNoWithHyphens));
  url.searchParams.set("start_date", params.start_date);
  url.searchParams.set("end_date", params.end_date);
  url.searchParams.set("page_size", String(page_size));
  url.searchParams.set("page", String(page));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      Authorization: `Bearer ${params.bearerToken}`,
      Origin: "https://ceo.yogiyo.co.kr",
      Referer: "https://ceo.yogiyo.co.kr/",
    },
    credentials: "include",
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `yogiyo billyo/settlement HTTP ${res.status}: ${text.slice(0, 500)}`,
    );
  }
  return JSON.parse(text) as YogiyoSettlementResponse;
}

export async function fetchYogiyoSettlementAllPages(params: Omit<FetchParams, "page">): Promise<{
  rows: YogiyoSettlementRow[];
  row_count: number | null;
}> {
  const page_size = params.page_size ?? 50;
  const first = await fetchYogiyoSettlementPage({ ...params, page_size, page: 1 });
  const total = typeof first.row_count === "number" && Number.isFinite(first.row_count)
    ? first.row_count
    : null;

  const rows: YogiyoSettlementRow[] = [...(first.rows ?? [])];
  if (total == null) {
    // row_count가 없을 수 있으니 "더 이상 안 늘어날 때"까지(최대 5000 페이지 safety)
    let lastLen = (first.rows ?? []).length;
    for (let page = 2; lastLen === page_size && page <= 5000; page++) {
      const next = await fetchYogiyoSettlementPage({ ...params, page_size, page });
      const chunk = next.rows ?? [];
      rows.push(...chunk);
      lastLen = chunk.length;
      if (chunk.length < page_size) break;
    }
    return { rows, row_count: total };
  }

  const lastPage = Math.max(1, Math.ceil(total / page_size));
  for (let page = 2; page <= lastPage; page++) {
    const next = await fetchYogiyoSettlementPage({ ...params, page_size, page });
    rows.push(...(next.rows ?? []));
  }
  return { rows, row_count: total };
}

