"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/components/ui/toast";

const MAX_VERIFY_ATTEMPTS_PER_HOUR = 3;
const VERIFY_COOLDOWN_SEC = 5 * 60;
const ONE_HOUR_MS = 60 * 60 * 1000;

function generateSixDigitCode() {
  return Math.random().toString().slice(2, 8);
}

export interface UseVerificationCodeFlowOptions {
  /** 발송 성공 시 토스트 메시지 */
  toastMessage: string;
}

export function useVerificationCodeFlow({
  toastMessage,
}: UseVerificationCodeFlowOptions) {
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [attemptTimestamps, setAttemptTimestamps] = useState<number[]>([]);
  const [rateLimitModalOpen, setRateLimitModalOpen] = useState(false);
  const [resendConfirmModalOpen, setResendConfirmModalOpen] = useState(false);
  const lastSentCodeRef = useRef("");
  const { addToast } = useToast();

  const attemptsInLastHour = attemptTimestamps.filter(
    (t) => Date.now() - t < ONE_HOUR_MS,
  ).length;

  const doSendCode = useCallback(async (): Promise<boolean> => {
    if (attemptsInLastHour >= MAX_VERIFY_ATTEMPTS_PER_HOUR) {
      setRateLimitModalOpen(true);
      return false;
    }
    setSending(true);
    try {
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
      addToast(toastMessage);
      return true;
    } finally {
      setSending(false);
    }
  }, [attemptsInLastHour, toastMessage, addToast]);

  useEffect(() => {
    if (!codeSentAt || !codeSent) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - codeSentAt) / 1000);
      const remaining = Math.max(0, VERIFY_COOLDOWN_SEC - elapsed);
      setTimerSeconds(remaining);
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

  return {
    code,
    setCode,
    codeSent,
    sending,
    timerSeconds,
    rateLimitModalOpen,
    setRateLimitModalOpen,
    resendConfirmModalOpen,
    setResendConfirmModalOpen,
    doSendCode,
    openResendConfirm,
    validateCode,
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
