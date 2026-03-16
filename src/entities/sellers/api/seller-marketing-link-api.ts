import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type SellerMarketingLinkData = {
  link: string;
};

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { code?: string; title?: string };
    const e = new Error(err.title ?? "Forbidden") as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "SELLER_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 셀러 영업(마케팅) 링크 조회 (is_seller만 허용) */
export const getSellerMarketingLink: AsyncApiRequestFn<
  SellerMarketingLinkData,
  void
> = async () => {
  const data = await getJson<{ result: SellerMarketingLinkData }>(
    API_ENDPOINT.sellers.marketingLink,
  );
  return data.result;
};
