"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";

/**
 * 클라이언트 측 인증 요청 제한.
 * @see https://supabase.com/docs/guides/deployment/going-into-prod#auth-rate-limits
 * - OTP: 서버 기본 60초 쿨다운, 360회/시간. 재요청 창은 서버와 맞춤(60초).
 */
const MAX_VERIFY_ATTEMPTS_PER_HOUR = 3;
/** 재인증 버튼 쿨다운(초). 이 시간 동안 재인증 불가. */
export const VERIFY_COOLDOWN_SEC = 60;
/** 인증번호 입력 유효시간(초). 이 시간 지나면 만료 메시지. */
export const CODE_VALIDITY_SEC = 180;
const ONE_HOUR_MS = 60 * 60 * 1000;

function generateSixDigitCode() {
  return Math.random().toString().slice(2, 8);
}

export interface UseVerificationCodeFlowOptions {
  /** 발송 성공 시 토스트 메시지 */
  toastMessage: string;
  /** 외부 발송 함수(예: Supabase OTP). 있으면 doSendCode(context)로 호출 */
  sendCodeFn?: (context: string) => Promise<boolean>;
  /** 외부 검증 함수(예: Supabase verifyOtp). 있으면 verifyCode(context, code)로 노출 */
  verifyCodeFn?: (context: string, code: string) => Promise<boolean>;
}

export function useVerificationCodeFlow({
  toastMessage,
  sendCodeFn,
  verifyCodeFn,
}: UseVerificationCodeFlowOptions) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  /** 인증번호 유효 남은 시간(초). 0이면 만료. */
  const [codeValidityRemainingSeconds, setCodeValidityRemainingSeconds] = useState(0);
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
      if (attemptsInLastHour >= MAX_VERIFY_ATTEMPTS_PER_HOUR) {
        setRateLimitModalOpen(true);
        return false;
      }
      setSending(true);
      try {
        if (sendCodeFn && context !== undefined) {
          const ok = await sendCodeFn(context);
          if (!ok) return false;
          const now = Date.now();
          setAttemptTimestamps((prev) => [
            ...prev.filter((t) => now - t < ONE_HOUR_MS),
            now,
          ]);
          setCodeSentAt(now);
          setCodeSent(true);
          setTimerSeconds(VERIFY_COOLDOWN_SEC);
          setCodeValidityRemainingSeconds(CODE_VALIDITY_SEC);
          addToast(toastMessage);
          console.log("[인증] 인증번호 발송 완료", { target: context, at: new Date(now).toISOString() });
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
        setTimerSeconds(VERIFY_COOLDOWN_SEC);
        setCodeValidityRemainingSeconds(CODE_VALIDITY_SEC);
        addToast(toastMessage);
        console.log("[인증] 인증번호 발송 완료", { target: context ?? "(로컬 mock)", at: new Date(now).toISOString() });
        return true;
      } finally {
        setSending(false);
      }
    },
    [attemptsInLastHour, toastMessage, addToast, sendCodeFn]
  );

  useEffect(() => {
    if (!codeSentAt || !codeSent) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      setTimerSeconds(Math.max(0, VERIFY_COOLDOWN_SEC - elapsed));
      setCodeValidityRemainingSeconds(Math.max(0, CODE_VALIDITY_SEC - elapsed));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [codeSentAt, codeSent]);

  const openResendConfirm = useCallback(() => {
    if (attemptsInLastHour >= MAX_VERIFY_ATTEMPTS_PER_HOUR) {
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
    [verifyCodeFn]
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

export type UseVerificationCodeFlowReturn = ReturnType<
  typeof useVerificationCodeFlow
>;
