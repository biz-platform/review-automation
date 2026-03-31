/**
 * 요기요 답글 등록/수정/삭제 — CEO API 직접 호출 (브라우저 불필요).
 * POST   /vendor/{vendorId}/reviews/{reviewId}/reply/
 * PATCH  /vendor/{vendorId}/reviews/{reviewId}/reply/{replyId}/
 * DELETE /vendor/{vendorId}/reviews/{reviewId}/reply/{replyId}/
 */
import * as YogiyoSession from "./yogiyo-session-service";
import { fetchAllYogiyoReviews } from "./yogiyo-review-service";

const API_BASE = "https://ceo-api.yogiyo.co.kr";
const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "Accept-Language": "ko-KR,ko;q=0.9",
  Referer: "https://ceo.yogiyo.co.kr/",
};

async function getAuth(
  storeId: string,
  userId: string,
  vendorIdOverride?: string | null,
): Promise<{ token: string; vendorId: string }> {
  const token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  if (!token) throw new Error("요기요 세션이 없습니다. 먼저 매장 연동을 진행해 주세요.");
  const fromSession = await YogiyoSession.getYogiyoVendorId(storeId, userId);
  const vendorId =
    (vendorIdOverride != null && String(vendorIdOverride).trim() !== ""
      ? String(vendorIdOverride).trim()
      : null) ?? fromSession?.trim() ?? null;
  if (!vendorId) throw new Error("요기요 가게 연동 정보가 없습니다.");
  return { token, vendorId };
}

/** 401이면 재로그인 후 true 반환(재시도 유도), 아니면 false */
async function maybeRefreshOn401(
  storeId: string,
  userId: string,
  res: Response,
): Promise<boolean> {
  if (res.status !== 401) return false;
  await YogiyoSession.refreshYogiyoSession(storeId, userId);
  return true;
}

/** 리뷰 목록 API에서 해당 리뷰의 reply.id 조회 (platform_reply_id 없을 때) */
export async function getYogiyoReplyIdFromList(
  storeId: string,
  userId: string,
  reviewExternalId: string,
  options?: { vendorId?: string | null },
): Promise<number | null> {
  const vid = options?.vendorId?.trim();
  const { list } = await fetchAllYogiyoReviews(storeId, userId, {
    ...(vid ? { vendorIds: [vid] } : {}),
    /** 답글 대상 리뷰가 30일 밖일 수 있음 */
    syncWindow: "initial",
  });
  const reviewIdNum = Number(reviewExternalId);
  if (!Number.isFinite(reviewIdNum)) return null;
  const review = list.find((r) => r.id === reviewIdNum);
  if (!review) return null;
  const reply = review.reply as { id?: number } | null | undefined;
  return reply?.id ?? null;
}

/** 답글 등록 — POST /vendor/{vendorId}/reviews/{reviewId}/reply/ */
export async function registerYogiyoReplyViaApi(
  storeId: string,
  userId: string,
  params: { reviewId: string; content: string; vendorId?: string | null },
): Promise<{ replyId: number }> {
  const doRequest = async (auth: { token: string; vendorId: string }) => {
    const url = `${API_BASE}/vendor/${auth.vendorId}/reviews/${params.reviewId}/reply/`;
    return fetch(url, {
      method: "POST",
      headers: { ...HEADERS, Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ comment: params.content.slice(0, 1000) }),
    });
  };
  let auth = await getAuth(storeId, userId, params.vendorId);
  let res = await doRequest(auth);
  if (await maybeRefreshOn401(storeId, userId, res)) {
    auth = await getAuth(storeId, userId, params.vendorId);
    res = await doRequest(auth);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`요기요 답글 등록 API ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { id?: number };
  const replyId = data?.id;
  if (replyId == null || !Number.isFinite(replyId)) {
    throw new Error("요기요 답글 등록 응답에 id가 없습니다.");
  }
  return { replyId };
}

export async function modifyYogiyoReplyViaApi(
  storeId: string,
  userId: string,
  params: {
    reviewId: string;
    replyId: string | number;
    content: string;
    vendorId?: string | null;
  },
): Promise<void> {
  const doRequest = async (auth: { token: string; vendorId: string }) => {
    const url = `${API_BASE}/vendor/${auth.vendorId}/reviews/${params.reviewId}/reply/${params.replyId}/`;
    return fetch(url, {
      method: "PATCH",
      headers: { ...HEADERS, Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ comment: params.content.slice(0, 1000) }),
    });
  };
  let auth = await getAuth(storeId, userId, params.vendorId);
  let res = await doRequest(auth);
  if (await maybeRefreshOn401(storeId, userId, res)) {
    auth = await getAuth(storeId, userId, params.vendorId);
    res = await doRequest(auth);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`요기요 답글 수정 API ${res.status}: ${text}`);
  }
}

export async function deleteYogiyoReplyViaApi(
  storeId: string,
  userId: string,
  params: { reviewId: string; replyId: string | number; vendorId?: string | null },
): Promise<void> {
  const doRequest = async (auth: { token: string; vendorId: string }) => {
    const url = `${API_BASE}/vendor/${auth.vendorId}/reviews/${params.reviewId}/reply/${params.replyId}/`;
    return fetch(url, {
      method: "DELETE",
      headers: { ...HEADERS, Authorization: `Bearer ${auth.token}` },
    });
  };
  let auth = await getAuth(storeId, userId, params.vendorId);
  let res = await doRequest(auth);
  if (await maybeRefreshOn401(storeId, userId, res)) {
    auth = await getAuth(storeId, userId, params.vendorId);
    res = await doRequest(auth);
  }
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(`요기요 답글 삭제 API ${res.status}: ${text}`);
  }
}
