"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkAvailability,
  sendVerificationCode,
  verifyVerificationCode,
} from "@/entities/auth/api/signup-api";
import { mapSupabaseAuthError } from "@/entities/auth/lib/map-supabase-auth-error";
import { RATE_LIMIT_MESSAGE } from "@/lib/constants/verification";
import type { SendCodeResult } from "./useVerificationCodeFlow";

type SetString = (value: string | null) => void;

export type UseSignupEmailFnsParams = {
  supabase: SupabaseClient;
  isDev: boolean;
  setEmailError: SetString;
  setStep1BottomMessage: SetString;
  setCodeError: SetString;
};

export type UseSignupPhoneFnsParams = {
  setPhoneError: SetString;
  setStep2BottomMessage: SetString;
  setCodeError: SetString;
};

export function useSignupEmailFns({
  supabase,
  isDev,
  setEmailError,
  setStep1BottomMessage,
  setCodeError,
}: UseSignupEmailFnsParams) {
  const sendCodeFn = async (emailAddress: string): Promise<SendCodeResult> => {
    try {
      const result = await checkAvailability({ email: emailAddress });
      if (result.emailAvailable === false) {
        setEmailError("이미 가입된 이메일입니다");
        setStep1BottomMessage(null);
        return false;
      }
    } catch (e) {
      setEmailError(
        e instanceof Error ? e.message : "가입 여부 확인에 실패했어요. 잠시 후 다시 시도해주세요."
      );
      setStep1BottomMessage(null);
      return false;
    }

    if (isDev) {
      try {
        const data = await sendVerificationCode({ email: emailAddress });
        setStep1BottomMessage(null);
        return { ok: true, devCode: data.devCode };
      } catch (e) {
        const err = e as Error & { code?: string };
        const msg = err.message ?? "인증번호 발송에 실패했어요";
        if (err.code === "OTP_COOLDOWN" || err.code === "OTP_MAX_PER_HOUR") {
          setStep1BottomMessage(msg);
          setEmailError(null);
        } else {
          setStep1BottomMessage(null);
          setEmailError(msg);
        }
        return false;
      }
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: emailAddress,
      options: { shouldCreateUser: true },
    });
    if (error) {
      const msg = mapSupabaseAuthError(error.message);
      if (msg === RATE_LIMIT_MESSAGE) {
        setStep1BottomMessage(msg);
        setEmailError(null);
      } else {
        setStep1BottomMessage(null);
        setEmailError(msg);
      }
      return false;
    }
    setStep1BottomMessage(null);
    return true;
  };

  const verifyCodeFn = async (emailAddress: string, token: string): Promise<boolean> => {
    if (isDev) {
      try {
        const data = await verifyVerificationCode({ email: emailAddress, code: token });
        return data.success;
      } catch {
        setCodeError("인증번호가 올바르지 않습니다");
        return false;
      }
    }
    const { error } = await supabase.auth.verifyOtp({
      email: emailAddress,
      token,
      type: "email",
    });
    if (error) {
      setCodeError(mapSupabaseAuthError(error.message));
      return false;
    }
    return true;
  };

  return { sendCodeFn, verifyCodeFn };
}

export function useSignupPhoneFns({
  setPhoneError,
  setStep2BottomMessage,
  setCodeError,
}: UseSignupPhoneFnsParams) {
  const sendCodeFn = async (phoneE164: string): Promise<SendCodeResult> => {
    try {
      const result = await checkAvailability({ phone: phoneE164 });
      if (result.phoneAvailable === false) {
        setPhoneError("이미 가입된 휴대전화 번호입니다");
        setStep2BottomMessage(null);
        return false;
      }
    } catch (e) {
      setPhoneError(
        e instanceof Error ? e.message : "가입 여부 확인에 실패했어요. 잠시 후 다시 시도해주세요."
      );
      setStep2BottomMessage(null);
      return false;
    }

    try {
      const data = await sendVerificationCode({ phone: phoneE164 });
      setStep2BottomMessage(null);
      return { ok: true, devCode: data.devCode };
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message ?? "인증번호 발송에 실패했어요";
      if (err.code === "OTP_COOLDOWN" || err.code === "OTP_MAX_PER_HOUR") {
        setStep2BottomMessage(msg);
        setPhoneError(null);
      } else {
        setStep2BottomMessage(null);
        setPhoneError(msg);
      }
      return false;
    }
  };

  const verifyCodeFn = async (phoneE164: string, token: string): Promise<boolean> => {
    try {
      const data = await verifyVerificationCode({ phone: phoneE164, code: token });
      return data.success;
    } catch {
      setCodeError("인증번호가 올바르지 않습니다");
      return false;
    }
  };

  return { sendCodeFn, verifyCodeFn };
}
