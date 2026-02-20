import * as YogiyoSession from "./yogiyo-session-service";

const API_BASE = "https://ceo-api.yogiyo.co.kr";
const PAGE_SIZE = 50;

const REQUEST_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://ceo.yogiyo.co.kr/",
};

export type YogiyoReviewItem = {
  id: number;
  nickname: string;
  rating: number;
  created_at: string;
  comment: string;
  menu_summary?: string | null;
  [key: string]: unknown;
};

type YogiyoReviewsResponse = {
  count?: number;
  total_count?: number;
  reviews?: YogiyoReviewItem[];
  next?: string | null;
  previous?: string | null;
};

/** 오늘 기준 최근 6개월(180일) YYYY-MM-DD */
export function defaultDateRange(): { create_from: string; create_to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 180);
  return {
    create_from: from.toISOString().slice(0, 10),
    create_to: to.toISOString().slice(0, 10),
  };
}

/**
 * 저장된 세션(vendor id + Bearer 토큰)으로 리뷰 v2 API 페이지네이션 호출 후 전체 리뷰 반환.
 */
export async function fetchAllYogiyoReviews(
  storeId: string,
  userId: string,
  options?: { create_from?: string; create_to?: string }
): Promise<{ list: YogiyoReviewItem[]; total: number }> {
  const vendorId = await YogiyoSession.getYogiyoVendorId(storeId, userId);
  if (!vendorId) {
    throw new Error("요기요 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.");
  }
  const token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  if (!token) {
    throw new Error("요기요 세션(토큰)이 없습니다. 먼저 연동해 주세요.");
  }

  const def = defaultDateRange();
  const create_from = options?.create_from ?? def.create_from;
  const create_to = options?.create_to ?? def.create_to;
  const all: YogiyoReviewItem[] = [];
  let page = 0;
  let total = 0;

  while (true) {
    const params = new URLSearchParams({
      create_from,
      create_to,
      no_reply_only: "false",
      page_size: String(PAGE_SIZE),
      page: String(page),
    });
    const url = `${API_BASE}/vendor/${vendorId}/reviews/v2/?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        ...REQUEST_HEADERS,
        Authorization: `Bearer ${token}`,
      },
      credentials: "omit",
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`요기요 리뷰 API ${res.status}: ${text}`);
    }

    const body = (await res.json()) as YogiyoReviewsResponse;
    const reviews = body.reviews ?? [];
    if (total === 0) total = body.total_count ?? body.count ?? 0;

    for (const item of reviews) {
      all.push(item);
    }

    if (reviews.length < PAGE_SIZE || all.length >= total) break;
    page += 1;
  }

  return { list: all, total };
}
