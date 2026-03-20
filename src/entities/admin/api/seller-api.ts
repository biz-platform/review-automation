import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  AdminSellerCustomerListData,
  AdminSellerListApiRequestData,
  AdminSellerListData,
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

/** 어드민 셀러 목록 */
export const getAdminSellers: AsyncApiRequestFn<
  AdminSellerListData,
  AdminSellerListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());
  if (params?.sellerType && params.sellerType !== "all") {
    searchParams.set("sellerType", params.sellerType);
  }
  const url = `${API_ENDPOINT.admin.sellers}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminSellerListData }>(url);
  return data.result;
};

/** 어드민: 특정 셀러 하위 고객 */
export const getAdminSellerCustomers: AsyncApiRequestFn<
  AdminSellerCustomerListData,
  { userId: string; limit?: number; offset?: number }
> = async ({ userId, limit, offset }) => {
  const searchParams = new URLSearchParams();
  if (limit != null) searchParams.set("limit", String(limit));
  if (offset != null) searchParams.set("offset", String(offset));
  const q = searchParams.toString();
  const url = `${API_ENDPOINT.admin.sellerCustomers(userId)}${q ? `?${q}` : ""}`;
  const data = await getJson<{ result: AdminSellerCustomerListData }>(url);
  return data.result;
};

/** 어드민: 셀러 삭제(회원 전환) */
export const deleteAdminSeller: AsyncApiRequestFn<
  { success: true },
  { userId: string }
> = async ({ userId }) => {
  const data = await getJson<{ result: { success: true } }>(
    API_ENDPOINT.admin.seller(userId),
    { method: "DELETE" },
  );
  return data.result ?? { success: true as const };
};
