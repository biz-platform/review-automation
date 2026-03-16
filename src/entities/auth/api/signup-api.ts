import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type CheckAvailabilityApiRequestData = {
  email?: string;
  phone?: string;
};

export type AvailabilityData = {
  emailAvailable?: boolean;
  phoneAvailable?: boolean;
};

export type SendVerificationCodeApiRequestData = {
  email?: string;
  phone?: string;
};

export type SendVerificationCodeData = {
  success: boolean;
  devCode?: string;
};

export type VerifyVerificationCodeApiRequestData = {
  email?: string;
  phone?: string;
  code: string;
};

export type VerifyVerificationCodeData = {
  success: boolean;
};

export type SignupApiRequestData = {
  email: string;
  phone: string;
  password: string;
  /** 셀러 영업 링크 ref(referral_code). 가입 시 referred_by_user_id 연결용 */
  referralCode?: string;
};

export type SignupData = {
  userId: string;
};

/** 회원가입: auth.users 생성 + public.users 프로필 등록 */
export const signup: AsyncApiRequestFn<SignupData, SignupApiRequestData> =
  async (params) => {
    const data = await fetchJson<{ result?: SignupData }>(
      API_ENDPOINT.auth.signup,
      { method: "POST", body: JSON.stringify(params) }
    );
    const result = data.result;
    if (!result?.userId) throw new Error("회원가입 응답이 올바르지 않습니다");
    return result;
  };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await res.json().catch(() => ({}))) as T & { title?: string; code?: string };
  if (!res.ok) {
    const err = new Error((body as { title?: string }).title ?? res.statusText) as Error & {
      code?: string;
    };
    err.code = (body as { code?: string }).code;
    throw err;
  }
  return body;
}

/** 이메일/휴대번호 가입 가능 여부 조회 (auth.users 기준). 발송 전 중복 검사용 */
export const checkAvailability: AsyncApiRequestFn<
  AvailabilityData,
  CheckAvailabilityApiRequestData
> = async (params) => {
  const res = await fetch(API_ENDPOINT.auth.availability, {
    method: "POST",
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as {
    result?: AvailabilityData;
    title?: string;
  };
  if (!res.ok) {
    const err = new Error(data.title ?? "가입 여부 확인에 실패했어요. 잠시 후 다시 시도해주세요.");
    throw err;
  }
  return data.result ?? {};
};

/** 인증번호 발송 (로컬: 이메일/휴대번호 모두 우리 API, 프로덕션: 이메일은 Supabase OTP) */
export const sendVerificationCode: AsyncApiRequestFn<
  SendVerificationCodeData,
  SendVerificationCodeApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: SendVerificationCodeData }>(
    API_ENDPOINT.auth.verificationCodes,
    { method: "POST", body: JSON.stringify(params) }
  );
  return data.result ?? { success: false };
};

/** 인증번호 검증 */
export const verifyVerificationCode: AsyncApiRequestFn<
  VerifyVerificationCodeData,
  VerifyVerificationCodeApiRequestData
> = async (params) => {
  const data = await fetchJson<{ result?: VerifyVerificationCodeData }>(
    API_ENDPOINT.auth.verificationCodesValidations,
    { method: "POST", body: JSON.stringify(params) }
  );
  return data.result ?? { success: false };
};
