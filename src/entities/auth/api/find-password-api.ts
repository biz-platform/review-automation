import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type FindPasswordSendCodeApiRequestData = {
  email: string;
  phone: string;
};

export type FindPasswordSendCodeData = {
  success: boolean;
  devCode?: string;
};

export type FindPasswordVerifyOtpApiRequestData = {
  email: string;
  phone: string;
  code: string;
};

export type FindPasswordVerifyOtpData = {
  recoverySessionId: string;
};

export type FindPasswordResetApiRequestData = {
  recoverySessionId: string;
  password: string;
};

export type FindPasswordResetData = {
  success: true;
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

export const findPasswordSendCode: AsyncApiRequestFn<
  FindPasswordSendCodeData,
  FindPasswordSendCodeApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: FindPasswordSendCodeData }>(
    API_ENDPOINT.auth.findPasswordSendCode,
    { method: "POST", body: JSON.stringify(params) },
  );
  const result = data.result;
  if (!result?.success) throw new Error("인증번호 발송 응답이 올바르지 않습니다");
  return result;
};

export const findPasswordVerifyOtp: AsyncApiRequestFn<
  FindPasswordVerifyOtpData,
  FindPasswordVerifyOtpApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: FindPasswordVerifyOtpData }>(
    API_ENDPOINT.auth.findPasswordVerifyOtp,
    { method: "POST", body: JSON.stringify(params) },
  );
  const result = data.result;
  if (!result?.recoverySessionId) throw new Error("응답이 올바르지 않습니다");
  return result;
};

export const findPasswordReset: AsyncApiRequestFn<
  FindPasswordResetData,
  FindPasswordResetApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: FindPasswordResetData }>(
    API_ENDPOINT.auth.findPasswordReset,
    { method: "POST", body: JSON.stringify(params) },
  );
  const result = data.result;
  if (!result?.success) throw new Error("비밀번호 변경 응답이 올바르지 않습니다");
  return result;
};
