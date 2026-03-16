import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  SellerSettlementListData,
  SellerSettlementListApiRequestData,
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
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "SELLER_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 셀러 정산 요약·목록 조회 (is_seller만 허용) */
export const getSellerSettlement: AsyncApiRequestFn<
  SellerSettlementListData,
  SellerSettlementListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.emailOrPhone?.trim())
    searchParams.set("emailOrPhone", params.emailOrPhone.trim());
  if (params?.yearMonth?.trim()) searchParams.set("yearMonth", params.yearMonth.trim());
  const url = `${API_ENDPOINT.sellers.settlement}?${searchParams.toString()}`;
  const data = await getJson<{ result: SellerSettlementListData }>(url);
  return data.result;
};
