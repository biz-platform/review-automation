"use client";

import { useState } from "react";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { OptionItem } from "@/components/ui/option-item";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { SERVICE_TERMS_TEXT, PRIVACY_POLICY_TEXT } from "@/const/terms";
import { findPasswordNewPasswordSchema } from "@/lib/validation/find-password-schema";

/** **로 감싼 구간을 <strong>으로 렌더 */
function TermsParagraph({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
}

export interface FindPasswordResetStepProps {
  onPrev: () => void;
  onComplete: (payload: { password: string }) => void;
  errorMessage?: string | null;
  submitting?: boolean;
}

function isValidNewPassword(value: string): boolean {
  return findPasswordNewPasswordSchema.safeParse(value).success;
}

/** 비밀번호 찾기 3단계: 새 비밀번호 + 약관 (회원가입 Step3와 동일, 공백 불가 규칙) */
export function FindPasswordResetStep({
  onPrev,
  onComplete,
  errorMessage = null,
  submitting = false,
}: FindPasswordResetStepProps) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(
    null,
  );

  const passwordValid = isValidNewPassword(password);
  const confirmMatch = password.length > 0 && password === passwordConfirm;
  const requiredAgreed = agree1 && agree2;
  const canComplete =
    passwordValid && confirmMatch && requiredAgreed && !submitting;

  const passwordError =
    password.length > 0 && !passwordValid
      ? "8~20자, 영문과 숫자를 조합해 입력해주세요"
      : undefined;
  const confirmError =
    passwordConfirm.length > 0 && !confirmMatch
      ? "비밀번호가 일치하지 않습니다"
      : undefined;

  const handleAgreeAll = () => {
    const next = !agreeAll;
    setAgreeAll(next);
    setAgree1(next);
    setAgree2(next);
  };

  return (
    <form
      className="mt-6 flex min-h-0 flex-1 flex-col gap-4 md:mt-12 md:gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (canComplete) onComplete({ password });
      }}
    >
      <PasswordField
        label="새로운 비밀번호"
        placeholder="비밀번호를 입력해주세요"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        errorMessage={passwordError}
        className="w-full"
      />
      <PasswordField
        placeholder="비밀번호를 다시 한번 입력해주세요"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        errorMessage={confirmError}
        className="w-full"
        aria-label="비밀번호 확인"
      />
      <p className="typo-body-02-regular text-gray-04">
        비밀번호는 8-20자의 영문, 숫자를 조합해 만들어주세요 (공백 불가)
      </p>

      {errorMessage ? (
        <p className="typo-body-02-regular text-red-01" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <OptionItem
          variant={agreeAll ? "checked" : "default"}
          onClick={handleAgreeAll}
          className="w-full rounded-lg border border-gray-07 bg-gray-08 px-5 py-2.5"
        >
          모든 항목에 동의합니다
        </OptionItem>
        <div className="mt-2 flex flex-col gap-2">
          <div className="flex w-full items-center gap-2">
            <OptionItem
              variant={agree1 ? "checked" : "default"}
              onClick={() => {
                const next = !agree1;
                setAgree1(next);
                setAgreeAll(next && agree2);
              }}
              className="flex-1 rounded-lg px-5 py-1"
            >
              <span className="text-blue-01">[필수]</span> 서비스 이용 약관
            </OptionItem>
            <button
              type="button"
              onClick={() => setTermsModal("terms")}
              className="shrink-0 typo-body-02-regular text-blue-01 underline"
            >
              보기
            </button>
          </div>
          <div className="flex w-full items-center gap-2">
            <OptionItem
              variant={agree2 ? "checked" : "default"}
              onClick={() => {
                const next = !agree2;
                setAgree2(next);
                setAgreeAll(agree1 && next);
              }}
              className="flex-1 rounded-lg px-5 py-1"
            >
              <span className="text-blue-01">[필수]</span> 개인정보 처리 방침
            </OptionItem>
            <button
              type="button"
              onClick={() => setTermsModal("privacy")}
              className="shrink-0 typo-body-02-regular text-blue-01 underline"
            >
              보기
            </button>
          </div>
        </div>

        <Modal
          open={termsModal !== null}
          onOpenChange={() => setTermsModal(null)}
          title={
            termsModal === "terms" ? "서비스 이용 약관" : "개인정보 처리 방침"
          }
          size="default"
          className="flex max-h-[85vh] max-w-[min(90vw,640px)] flex-col"
          footer={
            <Button
              type="button"
              variant="secondaryDark"
              onClick={() => setTermsModal(null)}
            >
              닫기
            </Button>
          }
        >
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-line pr-2 typo-body-02-regular text-gray-03">
            <TermsParagraph
              text={
                termsModal === "terms"
                  ? SERVICE_TERMS_TEXT
                  : termsModal === "privacy"
                    ? PRIVACY_POLICY_TEXT
                    : ""
              }
            />
          </div>
        </Modal>
      </div>

      <div className="min-h-4 flex-1 md:min-h-0" />

      <div className="sticky bottom-0 pb-6 pt-4 md:static md:bg-transparent md:p-0">
        <div className="flex gap-4">
          <Button
            type="button"
            variant="secondaryDark"
            disabled={submitting}
            className="h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 outline-wgray-01 md:max-w-[224px]"
            onClick={onPrev}
          >
            이전
          </Button>
          <Button
            type="submit"
            disabled={!canComplete}
            className={cn(
              "h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 md:max-w-[224px]",
              (!canComplete || submitting) &&
                "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
              canComplete && !submitting && "bg-main-03 outline-main-02",
            )}
          >
            {submitting ? "처리 중…" : "설정 완료"}
          </Button>
        </div>
      </div>
    </form>
  );
}
