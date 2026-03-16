import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type ApplySellerApiRequestData = {
  dbtalk_id: string;
  name: string;
  phone: string;
};

export type ApplySellerData = {
  success: true;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    title?: string;
    code?: string;
    detail?: string;
  };
  if (!res.ok) {
    const e = new Error(body.detail ?? body.title ?? "인증에 실패했습니다.") as Error & {
      code?: string;
    };
    e.code = body.code;
    throw e;
  }
  return body;
}

/** 셀러 등록 신청 (디비톡 센터장 인증) */
export const applySeller: AsyncApiRequestFn<
  ApplySellerData,
  ApplySellerApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result: ApplySellerData }>(
    API_ENDPOINT.sellers.apply,
    {
      method: "POST",
      body: JSON.stringify({
        dbtalk_id: params.dbtalk_id.trim(),
        name: params.name.trim(),
        phone: params.phone.trim(),
      }),
    },
  );
  return data.result ?? { success: true as const };
};
