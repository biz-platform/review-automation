"use client";

import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatVerificationTimer } from "./useVerificationCodeFlow";
import type { UseVerificationCodeFlowReturn } from "./useVerificationCodeFlow";

const PHONE_MAX_LENGTH = 11;
const PHONE_MIN_LENGTH_FOR_VERIFY = 10;

export interface SignupStep2Props {
  phone: string;
  onPhoneChange: (value: string) => void;
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  phoneFlow: UseVerificationCodeFlowReturn;
  onVerify: () => void | Promise<void>;
  onNext: () => void;
  onPrev: () => void;
}

export function SignupStep2({
  phone,
  onPhoneChange,
  codeError,
  setCodeError,
  phoneFlow,
  onVerify,
  onNext,
  onPrev,
}: SignupStep2Props) {
  const phoneDigits = phone.replace(/\D/g, "");
  const canVerify = phoneDigits.length >= PHONE_MIN_LENGTH_FOR_VERIFY;

  return (
    <form className="mt-10 flex flex-col gap-6 md:mt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        <TextField
          label="휴대전화 번호"
          type="tel"
          inputMode="numeric"
          placeholder="휴대전화 번호를 입력해주세요"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          maxLength={PHONE_MAX_LENGTH}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!canVerify || phoneFlow.sending}
          className={cn(
            "h-[52px] shrink-0 px-4 text-base md:w-[100px]",
            !canVerify &&
              "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
          )}
          onClick={phoneFlow.codeSent ? phoneFlow.openResendConfirm : onVerify}
        >
          {phoneFlow.sending
            ? "전송 중…"
            : phoneFlow.codeSent
              ? "재인증"
              : "인증"}
        </Button>
      </div>

      <TextField
        label="인증번호"
        placeholder="문자로 전송된 인증번호 6자리를 입력해주세요"
        value={phoneFlow.code}
        onChange={(e) => {
          phoneFlow.setCode(e.target.value);
          setCodeError(null);
        }}
        disabled={!phoneFlow.codeSent}
        maxLength={6}
        errorMessage={codeError ?? undefined}
        trailingAddon={
          phoneFlow.codeSent ? (
            <span className="text-base font-medium text-red-01 tabular-nums">
              {formatVerificationTimer(phoneFlow.timerSeconds)}
            </span>
          ) : undefined
        }
        className="w-full"
        keepDefaultOutlineWhenDisabled
      />

      <div className="flex-1" />

      <div className="flex gap-4">
        <Button
          type="button"
          variant="secondary"
          className="h-[52px] flex-1 rounded-lg text-base font-medium md:max-w-[224px]"
          onClick={onPrev}
        >
          이전
        </Button>
        <Button
          type="button"
          disabled={phoneFlow.code.length !== 6}
          variant="primary"
          className={cn(
            "h-[52px] flex-1 rounded-lg text-base font-medium outline-1 md:max-w-[224px]",
            phoneFlow.code.length !== 6 &&
              "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
            phoneFlow.code.length === 6 && "bg-main-03 outline-main-02",
          )}
          onClick={onNext}
        >
          다음
        </Button>
      </div>
    </form>
  );
}
