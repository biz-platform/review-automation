"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
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

const PHONE_MAX_LENGTH = 11;
const PHONE_MIN_LENGTH_FOR_VERIFY = 10;

export interface SignupStep2Props {
  phone: string;
  onPhoneChange: (value: string) => void;
  /** 휴대전화 번호 필드 에러 (예: 이미 가입된 번호) */
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
  /** 인증번호 필드 에러 (예: 만료, 불일치) */
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  phoneFlow: UseVerificationCodeFlowReturn;
  /** 이미 이 단계 인증을 통과한 뒤 뒤로 온 경우 true → 인증번호 input disabled */
  codeFieldLocked?: boolean;
  onVerify: () => boolean | Promise<boolean>;
  onNext: () => void;
  onPrev: () => void;
}

export function SignupStep2({
  phone,
  onPhoneChange,
  phoneError,
  setPhoneError,
  codeError,
  setCodeError,
  phoneFlow,
  codeFieldLocked = false,
  onVerify,
  onNext,
  onPrev,
}: SignupStep2Props) {
  const phoneDigits = phone.replace(/\D/g, "");
  const canVerify = phoneDigits.length >= PHONE_MIN_LENGTH_FOR_VERIFY;
  const [pendingVerify, setPendingVerify] = useState(false);

  const phoneInputDisabled =
    pendingVerify || phoneFlow.sending || phoneFlow.codeSent;

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

  return (
    <form className="mt-6 flex min-h-0 flex-1 flex-col gap-4 md:mt-12 md:gap-6">
      <div className="flex flex-row items-end gap-2 md:gap-4">
        <TextField
          label="휴대전화 번호"
          type="tel"
          inputMode="numeric"
          placeholder="휴대전화 번호를 입력해주세요"
          value={phone}
          onChange={(e) => {
            onPhoneChange(e.target.value);
            setPhoneError(null);
          }}
          maxLength={PHONE_MAX_LENGTH}
          errorMessage={phoneError ?? undefined}
          disabled={phoneInputDisabled}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondaryDark"
          disabled={
            !canVerify || phoneFlow.sending || pendingVerify || codeFieldLocked
          }
          className={cn(
            "h-[52px] w-20 shrink-0 px-4 typo-body-01-bold outline-1 outline-wgray-01 md:w-[100px]",
            (!canVerify ||
              phoneFlow.sending ||
              pendingVerify ||
              codeFieldLocked) &&
              "cursor-not-allowed !bg-wgray-06 text-gray-06 outline-wgray-04 hover:!bg-wgray-06",
          )}
          onClick={handleVerifyClick}
        >
          {phoneFlow.sending
            ? "전송중…"
            : phoneFlow.codeSent
              ? "재인증"
              : "인증"}
        </Button>
      </div>

      <TextField
        label="인증번호"
        placeholder="문자로 전송된 인증번호를 입력해주세요"
        value={phoneFlow.code}
        onChange={(e) => {
          phoneFlow.setCode(e.target.value);
          setCodeError(null);
        }}
        disabled={!phoneFlow.codeSent || codeFieldLocked}
        maxLength={6}
        errorMessage={codeError ?? undefined}
        trailingAddon={
          codeFieldLocked ? (
            <VerificationCompleteIcon />
          ) : phoneFlow.codeSent ? (
            <span className="typo-body-01-bold text-red-01 tabular-nums">
              {formatVerificationTimer(phoneFlow.timerSeconds)}
            </span>
          ) : undefined
        }
        className="w-full"
        keepDefaultOutlineWhenDisabled
      />

      <div className="flex-1 min-h-4 md:min-h-0" />

      <div className="sticky bottom-0 -mx-4 bg-gray-08 px-4 pb-6 pt-4 md:static md:mx-0 md:bg-transparent md:p-0">
        <div className="flex gap-4">
          <Button
            type="button"
            variant="secondaryDark"
            className="h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 outline-wgray-01 md:max-w-[224px]"
            onClick={onPrev}
          >
            이전
          </Button>
          <Button
            type="button"
            disabled={phoneFlow.code.length !== 6}
            variant="primary"
            className={cn(
              "h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 md:max-w-[224px]",
              phoneFlow.code.length !== 6 &&
                "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
              phoneFlow.code.length === 6 && "bg-main-03 outline-main-02",
            )}
            onClick={onNext}
          >
            다음
          </Button>
        </div>
      </div>
    </form>
  );
}
