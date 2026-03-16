import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  SellerCustomersListData,
  SellerCustomersListApiRequestData,
} from "@/entities/sellers/types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      message?: string;
      code?: string;
    };
    const msg = err.error ?? err.detail ?? err.message ?? res.statusText;
    const out = res.status === 403 ? "SELLER_REQUIRED" : msg;
    const e = new Error(out) as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "SELLER_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 셀러 하위 고객 목록 조회 (is_seller만 허용) */
export const getSellerCustomers: AsyncApiRequestFn<
  SellerCustomersListData,
  SellerCustomersListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.email?.trim()) searchParams.set("email", params.email.trim());
  const url = `${API_ENDPOINT.sellers.customers}?${searchParams.toString()}`;
  const data = await getJson<{ result: SellerCustomersListData }>(url);
  return data.result;
};
