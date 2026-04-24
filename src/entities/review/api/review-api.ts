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
  if (params.platform_shop_external_id)
    sp.set("platform_shop_external_id", params.platform_shop_external_id);
  if (params.platform) sp.set("platform", params.platform);
  if (params.linked_only) sp.set("linked_only", "true");
  if (params.filter && params.filter !== "all") sp.set("filter", params.filter);
  if (params.period_days != null) sp.set("period_days", String(params.period_days));
  if (params.rating_eq != null) sp.set("rating_eq", String(params.rating_eq));
  if (params.rating_lte != null) sp.set("rating_lte", String(params.rating_lte));
  if (params.include_drafts) sp.set("include_drafts", "true");
  if (params.limit != null) sp.set("limit", String(params.limit));
  if (params.offset != null) sp.set("offset", String(params.offset));
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export const getReviewList: AsyncApiRequestFn<
  { result: ReviewListData; count: number; has_more: boolean; next_offset: number },
  ReviewListApiRequestData
> = async (params) => {
  const data = await getJson<{
    result: ReviewListData;
    count: number;
    has_more: boolean;
    next_offset: number;
  }>(
    API_ENDPOINT.reviews.list + buildSearchParams(params ?? {}),
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
