import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  AdminStoreListApiRequestData,
  AdminStoreListData,
  AdminStoreDetailData,
  AdminWorkLogListApiRequestData,
  AdminWorkLogListData,
} from "@/entities/admin/types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      title?: string;
      message?: string;
      code?: string;
    };
    const msg = err.detail ?? err.error ?? err.title ?? err.message ?? res.statusText;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "ADMIN_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 어드민 고객별 매장 목록 */
export const getAdminStores: AsyncApiRequestFn<
  AdminStoreListData,
  AdminStoreListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.registrationMethod && params.registrationMethod !== "all") {
    searchParams.set("registrationMethod", params.registrationMethod);
  }
  if (params?.errorsOnly) searchParams.set("errorsOnly", "true");
  const url = `${API_ENDPOINT.admin.stores}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminStoreListData }>(url);
  return data.result;
};

/** 어드민 매장 상세 (특정 고객의 매장 요약 + 플랫폼별 세션) */
export const getAdminStoreDetail: AsyncApiRequestFn<
  AdminStoreDetailData,
  { userId: string }
> = async ({ userId }) => {
  const data = await getJson<{ result: AdminStoreDetailData }>(
    API_ENDPOINT.admin.storeDetail(userId),
  );
  return data.result;
};

/** 어드민 매장 상세 - 작업 로그 목록 */
export const getAdminStoreWorkLogs: AsyncApiRequestFn<
  AdminWorkLogListData,
  { userId: string } & AdminWorkLogListApiRequestData
> = async ({ userId, ...params }) => {
  const searchParams = new URLSearchParams();
  if (params?.storeId) searchParams.set("storeId", params.storeId);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.status && params.status !== "all")
    searchParams.set("status", params.status);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  const url = `${API_ENDPOINT.admin.storeWorkLogs(userId)}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminWorkLogListData }>(url);
  return data.result;
};
