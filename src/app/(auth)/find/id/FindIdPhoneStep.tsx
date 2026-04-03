"use client";

import { useState } from "react";
import { flushSync } from "react-dom";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils/cn";
import { useHasHover } from "@/lib/hooks/use-has-hover";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { formatVerificationTimer } from "@/app/(auth)/signup/useVerificationCodeFlow";
import type { UseVerificationCodeFlowReturn } from "@/app/(auth)/signup/useVerificationCodeFlow";

const PHONE_DISPLAY_MAX_LEN = 13;

export interface FindIdPhoneStepProps {
  phone: string;
  onPhoneChange: (value: string) => void;
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  phoneFlow: UseVerificationCodeFlowReturn;
  codeFieldPlaceholder: string;
  bottomMessage?: string | null;
  onVerify: () => boolean | Promise<boolean>;
  onNext: () => void;
  onPrev: () => void;
  /** 기본: 모바일「아이디 찾기」/ 데스크톱「아이디 확인」 */
  nextPrimaryLabelMobile?: string;
  nextPrimaryLabelDesktop?: string;
}

export function FindIdPhoneStep({
  phone,
  onPhoneChange,
  phoneError,
  setPhoneError,
  codeError,
  setCodeError,
  phoneFlow,
  codeFieldPlaceholder,
  bottomMessage = null,
  onVerify,
  onNext,
  onPrev,
  nextPrimaryLabelMobile = "아이디 찾기",
  nextPrimaryLabelDesktop = "아이디 확인",
}: FindIdPhoneStepProps) {
  const phoneDigits = phone.replace(/\D/g, "");
  const canVerify = phoneDigits.length >= PHONE_MIN_LENGTH_FOR_VERIFY;
  const [pendingVerify, setPendingVerify] = useState(false);

  const phoneInputDisabled =
    pendingVerify || phoneFlow.sending || phoneFlow.codeSent;

  const inCooldown = phoneFlow.codeSent && phoneFlow.timerSeconds > 0;
  const hasHover = useHasHover();

  const buttonDisabled =
    !canVerify || phoneFlow.sending || pendingVerify || inCooldown;

  const handleVerifyClick = () => {
    if (pendingVerify) return;
    flushSync(() => setPendingVerify(true));
    Promise.resolve(onVerify())
      .catch(() => {})
      .finally(() => {
        setPendingVerify(false);
      });
  };

  const verifyButton = (
    <Tooltip.Root>
      <Tooltip.Trigger key={String(inCooldown)}>
        <Button
          type="button"
          variant="secondaryDark"
          disabled={buttonDisabled}
          className={cn(
            "h-[52px] w-20 shrink-0 px-4 typo-body-01-bold outline-1 outline-wgray-01 md:w-[100px]",
            buttonDisabled &&
              "cursor-not-allowed !bg-wgray-06 text-gray-06 outline-wgray-04 hover:!bg-wgray-06",
          )}
          onClick={handleVerifyClick}
        >
          {phoneFlow.sending
            ? "전송중…"
            : phoneFlow.codeSent
              ? hasHover
                ? "재인증"
                : inCooldown
                  ? `재인증 (${phoneFlow.timerSeconds}초)`
                  : "재인증"
              : "인증"}
        </Button>
      </Tooltip.Trigger>
      {hasHover && inCooldown && (
        <Tooltip.Content className="w-max whitespace-nowrap">
          {phoneFlow.timerSeconds}초 후 재인증 가능해요
        </Tooltip.Content>
      )}
    </Tooltip.Root>
  );

  return (
    <form className="mt-6 flex min-h-0 flex-1 flex-col gap-4 md:mt-8 md:gap-6">
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
        maxLength={PHONE_DISPLAY_MAX_LEN}
        errorMessage={phoneError ?? undefined}
        disabled={phoneInputDisabled}
        className="min-w-0"
        trailingAction={verifyButton}
      />
      {bottomMessage ? (
        <p className="typo-body-02-regular text-red-01" role="alert">
          {bottomMessage}
        </p>
      ) : null}

      <TextField
        label="인증번호"
        placeholder={codeFieldPlaceholder}
        value={phoneFlow.code}
        onChange={(e) => {
          phoneFlow.setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
          setCodeError(null);
        }}
        disabled={!phoneFlow.codeSent}
        maxLength={6}
        inputMode="numeric"
        errorMessage={codeError ?? undefined}
        trailingAddon={
          phoneFlow.codeSent ? (
            <span className="typo-body-01-bold text-red-01 tabular-nums">
              {formatVerificationTimer(phoneFlow.codeValidityRemainingSeconds)}
            </span>
          ) : undefined
        }
        className="w-full"
        keepDefaultOutlineWhenDisabled
      />

      <div className="min-h-4 flex-1 md:min-h-0" />

      <div className="sticky bottom-0 bg-white pb-6 pt-4 md:static md:bg-transparent md:p-0">
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
            <span className="md:hidden">{nextPrimaryLabelMobile}</span>
            <span className="hidden md:inline">{nextPrimaryLabelDesktop}</span>
          </Button>
        </div>
      </div>
    </form>
  );
}
