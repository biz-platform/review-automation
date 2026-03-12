"use client";

import { useState, useEffect, useRef, useCallback, type Dispatch, type SetStateAction } from "react";
import { useToast } from "@/components/ui/toast";
import {
  OTP_MAX_ATTEMPTS_PER_HOUR,
  OTP_COOLDOWN_SEC,
  OTP_CODE_VALIDITY_SEC,
  ONE_HOUR_MS,
} from "@/lib/constants/verification";

/** 재인증 버튼 쿨다운(초). 서버와 동일 값. */
export const VERIFY_COOLDOWN_SEC = OTP_COOLDOWN_SEC;
/** 인증번호 입력 유효시간(초). UI 타이머용. */
export const CODE_VALIDITY_SEC = OTP_CODE_VALIDITY_SEC;

function generateSixDigitCode() {
  return Math.random().toString().slice(2, 8);
}

export type SendCodeResult =
  | boolean
  | { ok: true; devCode?: string };

export interface UseVerificationCodeFlowOptions {
  /** 발송 성공 시 토스트 메시지 */
  toastMessage: string;
  /** 외부 발송 함수. false 또는 { ok: true, devCode? } 반환 가능. devCode 있으면 토스트에 로컬 테스트 안내로 노출 */
  sendCodeFn?: (context: string) => Promise<SendCodeResult>;
  /** 외부 검증 함수(예: Supabase verifyOtp). 있으면 verifyCode(context, code)로 노출 */
  verifyCodeFn?: (context: string, code: string) => Promise<boolean>;
}

export function useVerificationCodeFlow({
  toastMessage,
  sendCodeFn,
  verifyCodeFn,
}: UseVerificationCodeFlowOptions): UseVerificationCodeFlowReturn {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  /** 인증번호 유효 남은 시간(초). 0이면 만료. */
  const [codeValidityRemainingSeconds, setCodeValidityRemainingSeconds] =
    useState(0);
  const [attemptTimestamps, setAttemptTimestamps] = useState<number[]>([]);
  const [rateLimitModalOpen, setRateLimitModalOpen] = useState(false);
  const [resendConfirmModalOpen, setResendConfirmModalOpen] = useState(false);
  const lastSentCodeRef = useRef("");
  const { addToast } = useToast();

  const attemptsInLastHour = attemptTimestamps.filter(
    (t) => Date.now() - t < ONE_HOUR_MS,
  ).length;

  const doSendCode = useCallback(
    async (context?: string): Promise<boolean> => {
      if (attemptsInLastHour >= OTP_MAX_ATTEMPTS_PER_HOUR) {
        setRateLimitModalOpen(true);
        return false;
      }
      setSending(true);
      try {
        if (sendCodeFn && context !== undefined) {
          const result = await sendCodeFn(context);
          const ok = typeof result === "object" ? result.ok : result;
          if (!ok) return false;
          const now = Date.now();
          setAttemptTimestamps((prev) => [
            ...prev.filter((t) => now - t < ONE_HOUR_MS),
            now,
          ]);
          setCodeSentAt(now);
          setCodeSent(true);
          setTimerSeconds(OTP_COOLDOWN_SEC);
          setCodeValidityRemainingSeconds(OTP_CODE_VALIDITY_SEC);
          const toastMsg =
            typeof result === "object" && result.devCode
              ? `${toastMessage} (로컬: ${result.devCode})`
              : toastMessage;
          addToast(toastMsg);
          console.log("[인증] 인증번호 발송 완료", {
            target: context,
            at: new Date(now).toISOString(),
          });
          return true;
        }
        await new Promise((r) => setTimeout(r, 500));
        const devCode = generateSixDigitCode();
        lastSentCodeRef.current = devCode;
        if (process.env.NODE_ENV === "development") {
          console.log("[로컬] 인증번호:", devCode);
        }
        const now = Date.now();
        setAttemptTimestamps((prev) => [
          ...prev.filter((t) => now - t < ONE_HOUR_MS),
          now,
        ]);
        setCodeSentAt(now);
        setCodeSent(true);
        setTimerSeconds(OTP_COOLDOWN_SEC);
        setCodeValidityRemainingSeconds(OTP_CODE_VALIDITY_SEC);
        addToast(toastMessage);
        console.log("[인증] 인증번호 발송 완료", {
          target: context ?? "(로컬 mock)",
          at: new Date(now).toISOString(),
        });
        return true;
      } finally {
        setSending(false);
      }
    },
    [attemptsInLastHour, toastMessage, addToast, sendCodeFn],
  );

  useEffect(() => {
    if (!codeSentAt || !codeSent) return;
    console.log("[인증타이머] 시작", {
      codeSentAt: new Date(codeSentAt).toISOString(),
      cooldownSec: OTP_COOLDOWN_SEC,
    });
    let lastLoggedAt = 0;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      const nextTimer = Math.max(0, OTP_COOLDOWN_SEC - elapsed);
      const nextValidity = Math.max(0, OTP_CODE_VALIDITY_SEC - elapsed);
      if (nextTimer === 0 && elapsed >= OTP_COOLDOWN_SEC) {
        console.log("[인증타이머] 쿨다운 종료", { elapsed, nextTimer });
      } else if (elapsed > 0 && elapsed % 15 === 0 && Date.now() - lastLoggedAt > 14000) {
        lastLoggedAt = Date.now();
        console.log("[인증타이머] 틱", { elapsed, nextTimer });
      }
      setTimerSeconds(nextTimer);
      setCodeValidityRemainingSeconds(nextValidity);
    };
    tick();
    const id = setInterval(tick, 1000);
    const onFocus = () => tick();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [codeSentAt, codeSent]);

  const openResendConfirm = useCallback(() => {
    if (attemptsInLastHour >= OTP_MAX_ATTEMPTS_PER_HOUR) {
      setRateLimitModalOpen(true);
      return;
    }
    setResendConfirmModalOpen(true);
  }, [attemptsInLastHour]);

  const validateCode = useCallback(() => {
    return code.trim() === lastSentCodeRef.current;
  }, [code]);

  const verifyCode = useCallback(
    (context: string, codeToVerify: string) => {
      if (verifyCodeFn) return verifyCodeFn(context, codeToVerify);
      return Promise.resolve(codeToVerify.trim() === lastSentCodeRef.current);
    },
    [verifyCodeFn],
  );

  return {
    code,
    setCode,
    codeSent,
    codeSentAt,
    sending,
    timerSeconds,
    codeValidityRemainingSeconds,
    rateLimitModalOpen,
    setRateLimitModalOpen,
    resendConfirmModalOpen,
    setResendConfirmModalOpen,
    doSendCode,
    openResendConfirm,
    validateCode,
    verifyCode,
  };
}

export function formatVerificationTimer(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface UseVerificationCodeFlowReturn {
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  codeSent: boolean;
  codeSentAt: number | null;
  sending: boolean;
  timerSeconds: number;
  codeValidityRemainingSeconds: number;
  rateLimitModalOpen: boolean;
  setRateLimitModalOpen: Dispatch<SetStateAction<boolean>>;
  resendConfirmModalOpen: boolean;
  setResendConfirmModalOpen: Dispatch<SetStateAction<boolean>>;
  doSendCode: (context?: string) => Promise<boolean>;
  openResendConfirm: () => void;
  validateCode: () => boolean;
  verifyCode: (context: string, codeToVerify: string) => Promise<boolean>;
}
