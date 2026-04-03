"use client";

import {
  findPasswordSendCode,
  findPasswordVerifyOtp,
} from "@/entities/auth/api/find-password-api";
import type { SendCodeResult } from "@/app/(auth)/signup/useVerificationCodeFlow";

type SetString = (value: string | null) => void;

export type UseFindPasswordPhoneFnsParams = {
  email: string;
  setPhoneError: SetString;
  setBottomMessage: SetString;
  setCodeError: SetString;
  onVerified: (recoverySessionId: string) => void;
};

export function useFindPasswordPhoneFns({
  email,
  setPhoneError,
  setBottomMessage,
  setCodeError,
  onVerified,
}: UseFindPasswordPhoneFnsParams) {
  const sendCodeFn = async (phoneE164: string): Promise<SendCodeResult> => {
    try {
      const data = await findPasswordSendCode({
        email: email.trim().toLowerCase(),
        phone: phoneE164,
      });
      setBottomMessage(null);
      return { ok: true, devCode: data.devCode };
    } catch (e) {
      const err = e as Error & { code?: string };
      const msg = err.message ?? "인증번호 발송에 실패했어요";
      if (err.code === "OTP_COOLDOWN" || err.code === "OTP_MAX_PER_HOUR") {
        setBottomMessage(msg);
        setPhoneError(null);
      } else if (err.code === "FIND_PASSWORD_PHONE_EMAIL_MISMATCH") {
        setBottomMessage(null);
        setPhoneError("가입 시 등록한 휴대전화 번호를 입력해주세요");
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
      const data = await findPasswordVerifyOtp({
        email: email.trim().toLowerCase(),
        phone: phoneE164,
        code: token,
      });
      onVerified(data.recoverySessionId);
      return true;
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "OTP_EXPIRED_OR_INVALID") {
        setCodeError("인증번호가 만료되어 다시 요청해주세요");
      } else if (err.code === "OTP_MISMATCH") {
        setCodeError("인증번호가 올바르지 않습니다");
      } else if (err.code === "OTP_VERIFY_MAX_PER_HOUR") {
        setCodeError("인증 시도 횟수를 초과했어요. 잠시 후 다시 시도해주세요");
      } else if (err.code === "FIND_PASSWORD_PHONE_EMAIL_MISMATCH") {
        setCodeError("이메일과 휴대전화 번호가 일치하지 않아요");
      } else {
        setCodeError(err.message ?? "인증번호가 올바르지 않습니다");
      }
      return false;
    }
  };

  return { sendCodeFn, verifyCodeFn };
}
