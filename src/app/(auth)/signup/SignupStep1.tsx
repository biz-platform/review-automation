"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useHasHover } from "@/lib/hooks/use-has-hover";
import { formatVerificationTimer } from "./useVerificationCodeFlow";
import type { UseVerificationCodeFlowReturn } from "./useVerificationCodeFlow";

function VerificationCompleteIcon() {
  return (
    <svg
      className="h-5 w-5 shrink-0 text-main-02"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 10l4 4 8-8" />
    </svg>
  );
}

export interface SignupStep1Props {
  email: string;
  setEmail: (v: string) => void;
  emailError: string | null;
  setEmailError: (v: string | null) => void;
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  emailFlow: UseVerificationCodeFlowReturn;
  /** 이미 이 단계 인증을 통과한 뒤 뒤로 온 경우 true → 인증번호 input disabled */
  codeFieldLocked?: boolean;
  /** label/input과 분리된 하단 메시지 (예: rate limit) */
  bottomMessage?: string | null;
  onVerify: () => boolean | Promise<boolean>;
  onNext: () => void;
}

export function SignupStep1({
  email,
  setEmail,
  emailError,
  setEmailError,
  codeError,
  setCodeError,
  emailFlow,
  codeFieldLocked = false,
  bottomMessage = null,
  onVerify,
  onNext,
}: SignupStep1Props) {
  const [pendingVerify, setPendingVerify] = useState(false);

  const emailInputDisabled =
    pendingVerify || emailFlow.sending || emailFlow.codeSent;

  /** 쿨다운 중(재발송 불가)일 때 true */
  const inCooldown = emailFlow.codeSent && emailFlow.timerSeconds > 0;
  const hasHover = useHasHover();

  const handleVerifyClick = () => {
    if (pendingVerify) return;
    flushSync(() => setPendingVerify(true));
    Promise.resolve(onVerify())
      .catch(() => {
        // noop
      })
      .finally(() => {
        setPendingVerify(false);
      });
  };

  const verifyButton = (
    <Tooltip.Root>
      <Tooltip.Trigger>
        <Button
          type="button"
          variant="secondaryDark"
          disabled={
            !email.trim() ||
            emailFlow.sending ||
            pendingVerify ||
            codeFieldLocked ||
            inCooldown
          }
          className={cn(
            "h-[52px] w-20 shrink-0 px-4 typo-body-01-bold outline-1 outline-wgray-01 md:w-[100px]",
            (!email.trim() ||
              emailFlow.sending ||
              pendingVerify ||
              codeFieldLocked ||
              inCooldown) &&
              "cursor-not-allowed !bg-wgray-06 text-gray-06 outline-wgray-04 hover:!bg-wgray-06",
          )}
          onClick={handleVerifyClick}
        >
          {emailFlow.sending
            ? "전송중…"
            : emailFlow.codeSent
              ? hasHover
                ? "재인증"
                : inCooldown
                  ? `재인증 (${emailFlow.timerSeconds}초)`
                  : "재인증"
              : "인증"}
        </Button>
      </Tooltip.Trigger>
      {hasHover && inCooldown && (
        <Tooltip.Content className="w-max whitespace-nowrap">
          {emailFlow.timerSeconds}초 후 재인증 가능해요
        </Tooltip.Content>
      )}
    </Tooltip.Root>
  );

  return (
    <form className="mt-6 flex min-h-0 flex-col gap-4 md:mt-12 md:gap-6">
      <TextField
        label="이메일"
        type="email"
        placeholder="이메일은 아이디로 사용돼요"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          setEmailError(null);
        }}
        errorMessage={emailError ?? undefined}
        disabled={emailInputDisabled}
        className="min-w-0 flex-1"
        trailingAction={verifyButton}
      />
      {bottomMessage ? (
        <p className="typo-body-02-regular text-red-01" role="alert">
          {bottomMessage}
        </p>
      ) : null}

      <TextField
        label="인증번호"
        placeholder="이메일로 전송된 인증번호를 입력해주세요"
        value={emailFlow.code}
        onChange={(e) => {
          emailFlow.setCode(e.target.value);
          setCodeError(null);
        }}
        disabled={!emailFlow.codeSent || codeFieldLocked}
        maxLength={6}
        errorMessage={codeError ?? undefined}
        trailingAddon={
          codeFieldLocked ? (
            <VerificationCompleteIcon />
          ) : emailFlow.codeSent ? (
            <span className="typo-body-01-bold text-red-01 tabular-nums">
              {formatVerificationTimer(emailFlow.codeValidityRemainingSeconds)}
            </span>
          ) : undefined
        }
        className="w-full"
        keepDefaultOutlineWhenDisabled
      />

      <div className="flex-1 min-h-4 md:min-h-0" />

      <div className="sticky bottom-0 -mx-4 bg-gray-08 px-4 pb-6 pt-4 md:static md:mx-0 md:bg-transparent md:p-0">
        <Button
          type="button"
          disabled={emailFlow.code.length !== 6}
          variant="primary"
          className={cn(
            "h-[52px] w-full rounded-lg typo-body-01-bold outline-1",
            emailFlow.code.length !== 6 &&
              "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
            emailFlow.code.length === 6 && "bg-main-03 outline-main-02",
          )}
          onClick={onNext}
        >
          다음
        </Button>
      </div>
    </form>
  );
}
