"use client";

import { useState } from "react";
import { PasswordField } from "@/components/ui/password-field";
import { Button } from "@/components/ui/button";
import { OptionItem } from "@/components/ui/option-item";
import { cn } from "@/lib/utils/cn";

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 20;
/** 8~20자, 영문·숫자 포함, 특수문자 허용(출력 가능한 ASCII) */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\x20-\x7E]{8,20}$/;

function isValidPassword(value: string): boolean {
  if (value.length < PASSWORD_MIN || value.length > PASSWORD_MAX) return false;
  return PASSWORD_REGEX.test(value);
}

export interface SignupStep3Props {
  onPrev: () => void;
  onComplete: (payload: { password: string }) => void;
}

/** P-03 비밀번호 입력 및 약관 — Figma 39-590 */
export function SignupStep3({ onPrev, onComplete }: SignupStep3Props) {
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [agree1, setAgree1] = useState(false);
  const [agree2, setAgree2] = useState(false);
  const [agreeAll, setAgreeAll] = useState(false);

  const passwordValid = isValidPassword(password);
  const confirmMatch = password.length > 0 && password === passwordConfirm;
  const requiredAgreed = agree1 && agree2;
  /** 완료 버튼: 정규식 통과 + 두 비밀번호 일치 + 필수 약관(1,2) 모두 동의 */
  const canComplete = passwordValid && confirmMatch && requiredAgreed;

  const passwordError =
    password.length > 0 && !passwordValid
      ? "8~20자, 영문과 숫자를 조합해 입력해주세요 (특수문자 사용 가능)"
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
      className="mt-10 flex flex-col gap-6 md:mt-12"
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
        label="비밀번호 확인"
        placeholder="비밀번호를 다시 한번 입력해주세요"
        value={passwordConfirm}
        onChange={(e) => setPasswordConfirm(e.target.value)}
        errorMessage={confirmError}
        className="w-full"
      />
      <p className="text-sm font-normal leading-[1.71] text-gray-04">
        비밀번호는 8-20자의 영문, 숫자를 조합해 만들어주세요 (특수문자 사용 가능)
      </p>

      <div className="flex flex-col gap-3">
        <OptionItem
          variant={agreeAll ? "checked" : "default"}
          onClick={handleAgreeAll}
          className="w-full rounded-lg border border-gray-07 bg-gray-08 px-5 py-3"
        >
          모든 항목에 동의합니다
        </OptionItem>
        <OptionItem
          variant={agree1 ? "checked" : "default"}
          onClick={() => {
            const next = !agree1;
            setAgree1(next);
            setAgreeAll(next && agree2);
          }}
        >
          [필수] CEO리뷰 서비스 이용 약관
        </OptionItem>
        <OptionItem
          variant={agree2 ? "checked" : "default"}
          onClick={() => {
            const next = !agree2;
            setAgree2(next);
            setAgreeAll(agree1 && next);
          }}
        >
          [필수] 개인정보 처리 방침
        </OptionItem>
      </div>

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
          type="submit"
          disabled={!canComplete}
          className={cn(
            "h-[52px] flex-1 rounded-lg text-base font-medium outline-1 md:max-w-[224px]",
            !canComplete &&
              "cursor-not-allowed bg-wgray-06 text-gray-06 outline-wgray-04 hover:bg-wgray-06",
            canComplete && "bg-main-03 outline-main-02",
          )}
        >
          완료
        </Button>
      </div>
    </form>
  );
}
