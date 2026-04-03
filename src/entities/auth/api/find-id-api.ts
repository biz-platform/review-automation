import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type FindIdVerifyApiRequestData = {
  phone: string;
  code: string;
};

export type FindIdVerifyData = {
  email: string;
};

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & {
    title?: string;
    code?: string;
  };
  if (!res.ok) {
    const err = new Error((body as { title?: string }).title ?? res.statusText) as Error & {
      code?: string;
    };
    err.code = (body as { code?: string }).code;
    throw err;
  }
  return body;
}

/** 휴대폰 인증번호 검증 후 가입 이메일 반환 (OTP 소비) */
export const findIdVerify: AsyncApiRequestFn<
  FindIdVerifyData,
  FindIdVerifyApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: FindIdVerifyData }>(
    API_ENDPOINT.auth.findIdVerify,
    { method: "POST", body: JSON.stringify(params) },
  );
  const result = data.result;
  if (!result?.email) throw new Error("응답이 올바르지 않습니다");
  return result;
};
