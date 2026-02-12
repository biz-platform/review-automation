import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  StoreData,
  StoreListData,
  CreateStoreApiRequestData,
  UpdateStoreApiRequestData,
  ToneSettingsData,
  ToneSettingsApiRequestData,
} from "@/entities/store/types";
async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string; detail?: string; message?: string };
    const msg = err.error ?? err.detail ?? err.message ?? res.statusText;
    const out = res.status === 429 ? `429 ${msg}` : msg;
    throw new Error(out);
  }
  return res.json();
}

export const getStoreList: AsyncApiRequestFn<
  StoreListData,
  { linkedPlatform?: string }
> = async (opts) => {
  const url =
    opts?.linkedPlatform != null
      ? `${API_ENDPOINT.stores.list}?linked_platform=${encodeURIComponent(opts.linkedPlatform)}`
      : API_ENDPOINT.stores.list;
  const data = await getJson<{ result: StoreListData }>(url);
  return data.result;
};

export const getStore: AsyncApiRequestFn<StoreData, { id: string }> = async ({ id }) => {
  const data = await getJson<{ result: StoreData }>(API_ENDPOINT.stores.one(id));
  return data.result;
};

export const createStore: AsyncApiRequestFn<StoreData, CreateStoreApiRequestData> = async (
  body
) => {
  const data = await getJson<{ result: StoreData }>(API_ENDPOINT.stores.list, {
    method: "POST",
    body: JSON.stringify(body),
  });
  return data.result;
};

export const updateStore: AsyncApiRequestFn<
  StoreData,
  { id: string } & UpdateStoreApiRequestData
> = async ({ id, ...body }) => {
  const data = await getJson<{ result: StoreData }>(API_ENDPOINT.stores.one(id), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  return data.result;
};

export const deleteStore: AsyncApiRequestFn<void, { id: string }> = async ({ id }) => {
  await fetch(API_ENDPOINT.stores.one(id), {
    method: "DELETE",
    credentials: "same-origin",
  });
};

export type BaeminReviewCountResult = {
  reviewCount: number;
  noCommentReviewCount: number;
  blockedReviewCount: number;
  recentReviewCount: number;
};

export type BaeminReviewItem = {
  id: number;
  shopNumber: number;
  contents: string;
  rating: number;
  memberNickname: string;
  createdAt: string;
  createdDate?: string;
  images?: Array<{ id: number; imageUrl: string }>;
  comments?: unknown[];
};

export type BaeminReviewListResult = {
  next: boolean;
  reviews: BaeminReviewItem[];
};

export type BaeminReviewSummaryResult = {
  count: BaeminReviewCountResult;
  list: BaeminReviewListResult;
};

export const getBaeminReviewCount: AsyncApiRequestFn<
  BaeminReviewCountResult,
  { storeId: string; from?: string; to?: string }
> = async ({ storeId, from, to }) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const url = `${API_ENDPOINT.stores.baeminReviewsCount(storeId)}?${params.toString()}`;
  const data = await getJson<{ result: BaeminReviewCountResult }>(url);
  return data.result;
};

export const getBaeminReviewList: AsyncApiRequestFn<
  BaeminReviewListResult,
  { storeId: string; from?: string; to?: string; offset?: number; limit?: number }
> = async ({ storeId, from, to, offset, limit }) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (offset != null) params.set("offset", String(offset));
  if (limit != null) params.set("limit", String(limit));
  const url = `${API_ENDPOINT.stores.baeminReviews(storeId)}?${params.toString()}`;
  const data = await getJson<{ result: BaeminReviewListResult }>(url);
  return data.result;
};

export const getBaeminReviewSummary: AsyncApiRequestFn<
  BaeminReviewSummaryResult,
  {
    storeId: string;
    from?: string;
    to?: string;
    offset?: number;
    limit?: number;
    fetchAll?: boolean;
  }
> = async ({ storeId, from, to, offset, limit, fetchAll }) => {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (offset != null) params.set("offset", String(offset));
  if (limit != null) params.set("limit", String(limit));
  if (fetchAll) params.set("fetchAll", "1");
  const url = `${API_ENDPOINT.stores.baeminReviewsSummary(storeId)}?${params.toString()}`;
  const data = await getJson<{ result: BaeminReviewSummaryResult }>(url);
  return data.result;
};

export const syncBaeminReviews: AsyncApiRequestFn<
  { upserted: number },
  { storeId: string }
> = async ({ storeId }) => {
  const data = await getJson<{ result: { upserted: number } }>(
    API_ENDPOINT.stores.baeminReviewsSync(storeId),
    { method: "POST" }
  );
  return data.result;
};

export const getToneSettings: AsyncApiRequestFn<ToneSettingsData, { storeId: string }> = async ({
  storeId,
}) => {
  const data = await getJson<{ result: ToneSettingsData }>(
    API_ENDPOINT.stores.toneSettings(storeId)
  );
  return data.result;
};

export const updateToneSettings: AsyncApiRequestFn<
  ToneSettingsData,
  { storeId: string } & ToneSettingsApiRequestData
> = async ({ storeId, ...body }) => {
  const data = await getJson<{ result: ToneSettingsData }>(
    API_ENDPOINT.stores.toneSettings(storeId),
    {
      method: "PATCH",
      body: JSON.stringify(body),
    }
  );
  return data.result;
};
