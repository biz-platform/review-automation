"use client";

import { useState } from "react";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { OptionItem } from "@/components/ui/option-item";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { SERVICE_TERMS_TEXT, PRIVACY_POLICY_TEXT } from "@/const/terms";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;
/** 8~20자, 영문·숫자 포함, 특수문자 허용(출력 가능한 ASCII) */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\x20-\x7E]{8,20}$/;

function isValidPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) return false;
  return PASSWORD_REGEX.test(value);
}

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

export interface SignupStep3Props {
  onPrev: () => void;
  onComplete: (payload: { password: string }) => void;
  /** 가입 API 실패 시 메시지 */
  errorMessage?: string | null;
  /** 가입 요청 진행 중 */
  submitting?: boolean;
}

/** P-03 비밀번호 입력 및 약관 — Figma 39-590 */
export function SignupStep3({
  onPrev,
  onComplete,
  errorMessage = null,
  submitting = false,
}: SignupStep3Props) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(
    null,
  );

  const passwordValid = isValidPassword(password);
  const confirmMatch = password.length > 0 && password === passwordConfirm;
  const requiredAgreed = agree1 && agree2;
  /** 완료 버튼: 정규식 통과 + 두 비밀번호 일치 + 필수 약관(1,2) 모두 동의, 전송 중 아님 */
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
        label="비밀번호"
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
        비밀번호는 8-20자의 영문, 숫자를 조합해 만들어주세요
      </p>

      {errorMessage ? (
        <p className="typo-body-02-regular text-red-01" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 mt-4">
        <OptionItem
          variant={agreeAll ? "checked" : "default"}
          onClick={handleAgreeAll}
          className="w-full rounded-lg border border-gray-07 bg-gray-08 px-5 py-2.5"
        >
          모든 항목에 동의합니다
        </OptionItem>
        <div className="flex flex-col gap-2 mt-2">
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
          className="max-w-[min(90vw,640px)] max-h-[85vh] flex flex-col"
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
          <div className="max-h-[60vh] overflow-y-auto typo-body-02-regular text-gray-03 whitespace-pre-line pr-2">
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

      <div className="flex-1 min-h-4 md:min-h-0" />

      <div className="sticky bottom-0 -mx-4 bg-gray-08 px-4 pb-6 pt-4 md:static md:mx-0 md:bg-transparent md:p-0">
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
            {submitting ? "가입 중…" : "완료"}
          </Button>
        </div>
      </div>
    </form>
  );
}
