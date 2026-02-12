import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type { ReviewData, ReviewListData, ReviewListApiRequestData } from "@/entities/review/types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.message ?? res.statusText);
  }
  return res.json();
}

function buildSearchParams(params: ReviewListApiRequestData): string {
  const sp = new URLSearchParams();
  if (params.store_id) sp.set("store_id", params.store_id);
  if (params.platform) sp.set("platform", params.platform);
  if (params.linked_only) sp.set("linked_only", "true");
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export const getReviewList: AsyncApiRequestFn<
  { result: ReviewListData; count: number },
  ReviewListApiRequestData
> = async (params) => {
  const data = await getJson<{ result: ReviewListData; count: number }>(
    API_ENDPOINT.reviews.list + buildSearchParams(params ?? {})
  );
  return data;
};

export const getReview: AsyncApiRequestFn<ReviewData, { id: string }> = async ({ id }) => {
  const data = await getJson<{ result: ReviewData }>(API_ENDPOINT.reviews.one(id));
  return data.result;
};

export const collectReviews: AsyncApiRequestFn<{ collected: number }, { reviewId: string }> =
  async ({ reviewId }) => {
    const data = await getJson<{ result: { collected: number } }>(
      API_ENDPOINT.reviews.collect(reviewId),
      { method: "POST" }
    );
    return data.result;
  };
