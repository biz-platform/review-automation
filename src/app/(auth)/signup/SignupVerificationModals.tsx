"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  OTP_MAX_ATTEMPTS_MODAL_MESSAGE,
  RATE_LIMIT_MESSAGE,
} from "@/lib/constants/verification";

export interface SignupVerificationModalsProps {
  rateLimitModalOpen: boolean;
  onRateLimitModalOpenChange: (open: boolean) => void;
  resendConfirmModalOpen: boolean;
  onResendConfirmModalOpenChange: (open: boolean) => void;
  sending: boolean;
  onResendConfirm: () => void | Promise<void>;
}

/** 인증 시도 횟수 초과 + 재인증 확인 모달 (이메일/휴대전화 공통) */
export function SignupVerificationModals({
  rateLimitModalOpen,
  onRateLimitModalOpenChange,
  resendConfirmModalOpen,
  onResendConfirmModalOpenChange,
  sending,
  onResendConfirm,
}: SignupVerificationModalsProps) {
  return (
    <>
      <Modal
        open={rateLimitModalOpen}
        onOpenChange={(open) => !open && onRateLimitModalOpenChange(false)}
        title="인증 시도 횟수가 초과되었어요"
        description={
          <>
            {OTP_MAX_ATTEMPTS_MODAL_MESSAGE}
            <br />
            {RATE_LIMIT_MESSAGE}
          </>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            className="h-[38px] w-20 bg-red-02 text-sm outline-red-01"
            onClick={() => onRateLimitModalOpenChange(false)}
          >
            확인
          </Button>
        }
        className="rounded-lg pb-[30px]"
      />
      <Modal
        open={resendConfirmModalOpen}
        onOpenChange={(open) => !open && onResendConfirmModalOpenChange(false)}
        title="인증번호를 다시 발송하시겠습니까?"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="h-[38px]"
              onClick={() => onResendConfirmModalOpenChange(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-[38px] w-20 bg-red-02 text-sm outline-red-01"
              disabled={sending}
              onClick={onResendConfirm}
            >
              {sending ? "전송중…" : "확인"}
            </Button>
          </div>
        }
        className="rounded-lg pb-[30px]"
      />
    </>
  );
}
