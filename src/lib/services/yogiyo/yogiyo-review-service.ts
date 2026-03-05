import { getDefaultReviewDateRange, toYYYYMMDD } from "@/lib/utils/review-date-range";
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

/** 현재 세션으로 한 페이지 요청. 401이면 재로그인 후 재시도 1회 */
async function fetchYogiyoReviewsPage(
  storeId: string,
  userId: string,
  vendorId: string,
  token: string,
  create_from: string,
  create_to: string,
  page: number,
): Promise<{ res: Response; didRefresh: boolean }> {
  const params = new URLSearchParams({
    create_from,
    create_to,
    no_reply_only: "false",
    page_size: String(PAGE_SIZE),
    page: String(page),
  });
  const url = `${API_BASE}/vendor/${vendorId}/reviews/v2/?${params.toString()}`;
  let res = await fetch(url, {
    method: "GET",
    headers: { ...REQUEST_HEADERS, Authorization: `Bearer ${token}` },
    credentials: "omit",
  });
  let didRefresh = false;
  if (res.status === 401) {
    await YogiyoSession.refreshYogiyoSession(storeId, userId);
    didRefresh = true;
    const newVendorId = await YogiyoSession.getYogiyoVendorId(storeId, userId);
    const newToken = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
    if (!newVendorId || !newToken) throw new Error("요기요 세션 갱신 후에도 인증 정보를 가져올 수 없습니다.");
    const url2 = `${API_BASE}/vendor/${newVendorId}/reviews/v2/?${params.toString()}`;
    res = await fetch(url2, {
      method: "GET",
      headers: { ...REQUEST_HEADERS, Authorization: `Bearer ${newToken}` },
      credentials: "omit",
    });
  }
  return { res, didRefresh };
}

/**
 * 저장된 세션(vendor id + Bearer 토큰)으로 리뷰 v2 API 페이지네이션 호출 후 전체 리뷰 반환.
 * 401 시 저장된 계정으로 재로그인 후 재시도.
 */
export async function fetchAllYogiyoReviews(
  storeId: string,
  userId: string,
  options?: { create_from?: string; create_to?: string }
): Promise<{ list: YogiyoReviewItem[]; total: number }> {
  let vendorId = await YogiyoSession.getYogiyoVendorId(storeId, userId);
  if (!vendorId) {
    throw new Error("요기요 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.");
  }
  let token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  if (!token) {
    throw new Error("요기요 세션(토큰)이 없습니다. 먼저 연동해 주세요.");
  }

  const { since, to } = getDefaultReviewDateRange();
  const create_from = options?.create_from ?? toYYYYMMDD(since);
  const create_to = options?.create_to ?? toYYYYMMDD(to);
  const all: YogiyoReviewItem[] = [];
  let page = 0;
  let total = 0;

  while (true) {
    const { res, didRefresh } = await fetchYogiyoReviewsPage(
      storeId,
      userId,
      vendorId,
      token,
      create_from,
      create_to,
      page,
    );
    if (didRefresh) {
      vendorId = (await YogiyoSession.getYogiyoVendorId(storeId, userId)) ?? vendorId;
      token = (await YogiyoSession.getYogiyoBearerToken(storeId, userId)) ?? token;
    }

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
