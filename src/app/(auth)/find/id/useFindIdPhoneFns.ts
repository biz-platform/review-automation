"use client";

import {
  checkAvailability,
  sendVerificationCode,
} from "@/entities/auth/api/signup-api";
import { findIdVerify } from "@/entities/auth/api/find-id-api";
import type { SendCodeResult } from "@/app/(auth)/signup/useVerificationCodeFlow";

type SetString = (value: string | null) => void;

export type UseFindIdPhoneFnsParams = {
  setPhoneError: SetString;
  setBottomMessage: SetString;
  setCodeError: SetString;
  onVerifiedEmail: (email: string) => void;
};

export function useFindIdPhoneFns({
  setPhoneError,
  setBottomMessage,
  setCodeError,
  onVerifiedEmail,
}: UseFindIdPhoneFnsParams) {
  const sendCodeFn = async (phoneE164: string): Promise<SendCodeResult> => {
    try {
      const result = await checkAvailability({ phone: phoneE164 });
      if (result.phoneAvailable !== false) {
        setPhoneError("입력한 휴대전화 번호로 가입된 계정이 없어요");
        setBottomMessage(null);
        return false;
      }
    } catch (e) {
      setPhoneError(
        e instanceof Error
          ? e.message
          : "가입 여부 확인에 실패했어요. 잠시 후 다시 시도해주세요.",
      );
      setBottomMessage(null);
      return false;
    }

    try {
      const data = await sendVerificationCode({ phone: phoneE164 });
      setBottomMessage(null);
      return { ok: true, devCode: data.devCode };
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message ?? "인증번호 발송에 실패했어요";
      if (err.code === "OTP_COOLDOWN" || err.code === "OTP_MAX_PER_HOUR") {
        setBottomMessage(msg);
        setPhoneError(null);
      } else {
        setBottomMessage(null);
        setPhoneError(msg);
      }
      return false;
    }
  };

  const verifyCodeFn = async (
    phoneE164: string,
    token: string,
  ): Promise<boolean> => {
    try {
      const data = await findIdVerify({ phone: phoneE164, code: token });
      onVerifiedEmail(data.email);
      return true;
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "OTP_EXPIRED_OR_INVALID") {
        setCodeError("인증번호가 만료되어 다시 요청해주세요");
      } else if (err.code === "OTP_MISMATCH") {
        setCodeError("인증번호가 올바르지 않습니다");
      } else {
        setCodeError(err.message ?? "인증번호가 올바르지 않습니다");
      }
      return false;
    }
  };

  return { sendCodeFn, verifyCodeFn };
}
