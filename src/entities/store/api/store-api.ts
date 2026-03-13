import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import { pollBrowserJob } from "@/lib/poll-browser-job";
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
  { linkedPlatform?: string } | undefined
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

/** GET /api/stores/[storeId]/jobs/[jobId] — sync job 상태 폴링용 */
export async function getBrowserJobStatus(
  storeId: string,
  jobId: string,
): Promise<{ status: string; error_message?: string; store_id?: string }> {
  const url = `${API_ENDPOINT.stores.one(storeId)}/jobs/${jobId}`;
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(`Job status ${res.status}`);
  const data = await res.json();
  const result = data.result ?? data;
  return {
    status: result.status ?? "pending",
    error_message: result.error_message,
    store_id: result.store_id,
  };
}

/** POST만 수행하고 jobId 반환. 폴링은 useQuery로 별도 처리 (link와 동일 패턴) */
export const startSyncBaeminReviews: AsyncApiRequestFn<
  { jobId: string },
  { storeId: string; signal?: AbortSignal }
> = async ({ storeId, signal }) => {
  const res = await fetch(API_ENDPOINT.stores.baeminReviewsSync(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { result?: { jobId?: string }; jobId?: string; detail?: string };
  const jobId = body.result?.jobId ?? body.jobId;
  if (res.status === 202 && jobId) return { jobId };
  if (!res.ok) throw new Error(body.detail ?? res.statusText);
  return { jobId: "" };
};

export const syncBaeminReviews: AsyncApiRequestFn<
  { upserted: number },
  { storeId: string; signal?: AbortSignal; onJobId?: (jobId: string) => void }
> = async ({ storeId, signal, onJobId }) => {
  const res = await fetch(API_ENDPOINT.stores.baeminReviewsSync(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { result?: { jobId?: string; upserted?: number }; jobId?: string; detail?: string };
  const jobId = body.result?.jobId ?? body.jobId;
  if (res.status === 202 && jobId) {
    onJobId?.(jobId);
    const job = await pollBrowserJob(storeId, jobId, { signal });
    if (job.status === "failed") {
      throw new Error(job.error_message ?? "리뷰 동기화 실패");
    }
    if (job.status === "cancelled") {
      throw new DOMException("취소됨", "AbortError");
    }
    return { upserted: 0 };
  }
  if (!res.ok) {
    throw new Error(body.detail ?? res.statusText);
  }
  return { upserted: body.result?.upserted ?? 0 };
};

export const syncDdangyoReviews: AsyncApiRequestFn<
  { upserted: number },
  { storeId: string; signal?: AbortSignal }
> = async ({ storeId, signal }) => {
  const res = await fetch(API_ENDPOINT.stores.ddangyoReviewsSync(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { result?: { jobId?: string }; jobId?: string; detail?: string };
  const jobId = body.result?.jobId ?? body.jobId;
  if (res.status === 202 && jobId) {
    const job = await pollBrowserJob(storeId, jobId, { signal });
    if (job.status === "failed") {
      throw new Error(job.error_message ?? "리뷰 동기화 실패");
    }
    if (job.status === "cancelled") {
      throw new DOMException("취소됨", "AbortError");
    }
    return { upserted: 0 };
  }
  if (!res.ok) {
    throw new Error(body.detail ?? res.statusText);
  }
  return { upserted: 0 };
};

export const syncYogiyoReviews: AsyncApiRequestFn<
  { upserted: number },
  { storeId: string; signal?: AbortSignal }
> = async ({ storeId, signal }) => {
  const res = await fetch(API_ENDPOINT.stores.yogiyoReviewsSync(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { result?: { jobId?: string }; jobId?: string; detail?: string };
  const jobId = body.result?.jobId ?? body.jobId;
  if (res.status === 202 && jobId) {
    const job = await pollBrowserJob(storeId, jobId, { signal });
    if (job.status === "failed") {
      throw new Error(job.error_message ?? "리뷰 동기화 실패");
    }
    if (job.status === "cancelled") {
      throw new DOMException("취소됨", "AbortError");
    }
    return { upserted: 0 };
  }
  if (!res.ok) {
    throw new Error(body.detail ?? res.statusText);
  }
  return { upserted: 0 };
};

export const syncCoupangEatsReviews: AsyncApiRequestFn<
  { upserted: number },
  { storeId: string; signal?: AbortSignal }
> = async ({ storeId, signal }) => {
  const res = await fetch(API_ENDPOINT.stores.coupangEatsReviewsSync(storeId), {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as { result?: { jobId?: string }; jobId?: string; detail?: string };
  const jobId = body.result?.jobId ?? body.jobId;
  if (res.status === 202 && jobId) {
    const job = await pollBrowserJob(storeId, jobId, { signal });
    if (job.status === "failed") {
      throw new Error(job.error_message ?? "리뷰 동기화 실패");
    }
    if (job.status === "cancelled") {
      throw new DOMException("취소됨", "AbortError");
    }
    return { upserted: 0 };
  }
  if (!res.ok) {
    throw new Error(body.detail ?? res.statusText);
  }
  return { upserted: 0 };
};

/** 사용자 취소 요청. 워커가 해당 job을 중단하도록 상태를 cancelled로 변경 */
export async function cancelBrowserJobRequest(
  storeId: string,
  jobId: string
): Promise<{ ok: boolean }> {
  const res = await fetch(API_ENDPOINT.stores.jobCancel(storeId, jobId), {
    method: "POST",
    credentials: "same-origin",
  });
  const data = (await res.json().catch(() => ({}))) as {
    result?: { ok?: boolean };
    ok?: boolean;
  };
  if (!res.ok) throw new Error("취소 요청 실패");
  const payload = data.result ?? data;
  return { ok: payload?.ok ?? false };
}

export const getToneSettings: AsyncApiRequestFn<
  ToneSettingsData | null,
  { storeId: string }
> = async ({ storeId }) => {
  const data = await getJson<{ result: ToneSettingsData | null }>(
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
