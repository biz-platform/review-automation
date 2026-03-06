"use client";

import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatVerificationTimer } from "./useVerificationCodeFlow";
import type { UseVerificationCodeFlowReturn } from "./useVerificationCodeFlow";

export interface SignupStep1Props {
  email: string;
  setEmail: (v: string) => void;
  emailError: string | null;
  setEmailError: (v: string | null) => void;
  codeError: string | null;
  setCodeError: (v: string | null) => void;
  emailFlow: UseVerificationCodeFlowReturn;
  onVerify: () => void | Promise<void>;
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
  onVerify,
  onNext,
}: SignupStep1Props) {
  return (
    <form className="mt-10 flex flex-col gap-6 md:mt-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-4">
        <TextField
          label="이메일"
          type="email"
          placeholder="입력한 이메일은 아이디로 사용돼요"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setEmailError(null);
          }}
          errorMessage={emailError ?? undefined}
          className="min-w-0 flex-1"
        />
        <Button
          type="button"
          variant="secondary"
          disabled={!email.trim() || emailFlow.sending}
          className={cn(
            "h-[52px] shrink-0 px-4 text-base md:w-[100px]",
            !email.trim() &&
              "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
          )}
          onClick={emailFlow.codeSent ? emailFlow.openResendConfirm : onVerify}
        >
          {emailFlow.sending
            ? "전송 중…"
            : emailFlow.codeSent
              ? "재인증"
              : "인증"}
        </Button>
      </div>

      <TextField
        label="인증번호"
        placeholder="이메일로 전송된 인증번호 6자리를 입력해주세요"
        value={emailFlow.code}
        onChange={(e) => {
          emailFlow.setCode(e.target.value);
          setCodeError(null);
        }}
        disabled={!emailFlow.codeSent}
        maxLength={6}
        errorMessage={codeError ?? undefined}
        trailingAddon={
          emailFlow.codeSent ? (
            <span className="text-base font-medium text-red-01 tabular-nums">
              {formatVerificationTimer(emailFlow.timerSeconds)}
            </span>
          ) : undefined
        }
        className="w-full"
        keepDefaultOutlineWhenDisabled
      />

      <div className="flex-1" />

      <Button
        type="button"
        disabled={emailFlow.code.length !== 6}
        variant="primary"
        className={cn(
          "h-[52px] w-full rounded-lg text-base font-medium outline-1",
          emailFlow.code.length !== 6 &&
            "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
          emailFlow.code.length === 6 && "bg-main-03 outline-main-02",
        )}
        onClick={onNext}
      >
        다음
      </Button>
    </form>
  );
}
