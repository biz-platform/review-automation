"use client";

import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type FindIdResultStepProps = {
  email: string;
  className?: string;
};

/** 아이디 찾기 완료 — Figma 데스크톱 253:2730 / 모바일 209:10290 */
export function FindIdResultStep({ email, className }: FindIdResultStepProps) {
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col md:mt-2", className)}>
      <div className="flex flex-col gap-3">
        <p className="typo-body-01-regular text-gray-01 md:text-gray-03">
          찾은 이메일은 아래와 같습니다
        </p>

        <div
          className={cn(
            "w-full rounded-lg border border-gray-07 bg-wgray-06 px-5 py-4",
            "min-h-[52px] md:flex md:min-h-[56px] md:items-center md:justify-center md:py-3.5",
          )}
          role="status"
          aria-live="polite"
        >
          <p
            className={cn(
              "typo-body-01-regular break-all text-gray-02",
              "text-left md:text-center",
            )}
          >
            {email}
          </p>
        </div>
      </div>

      <div className="min-h-6 flex-1 md:min-h-8" aria-hidden />

      <div className="flex shrink-0 gap-3 pb-2 md:gap-4 md:pb-0">
        <ButtonLink
          href="/find/password"
          variant="secondaryDark"
          className="h-[52px] flex-1 rounded-lg typo-body-01-bold outline-1 outline-wgray-01"
        >
          비밀번호 찾기
        </ButtonLink>
        <ButtonLink
          href="/login"
          variant="primary"
          className="h-[52px] flex-1 rounded-lg bg-main-03 typo-body-01-bold outline-1 outline-main-02"
        >
          로그인
        </ButtonLink>
      </div>
    </div>
  );
}
