"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { PlatformLinkForm } from "@/components/store/PlatformLinkForm";
import { PlatformIcon } from "@/components/store/PlatformIcon";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

export interface StoresUnlinkedViewProps {
  platform: string;
  platformLabel: string;
  descriptionLines: [string, string];
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  linkError: string | null;
  onLink: () => void;
  linking: boolean;
}

const inputClass =
  "h-12 w-full rounded-lg border border-gray-07 bg-white pl-4 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none focus:border-gray-03 focus:ring-1 focus:ring-gray-03";

/** 모바일 전용: 아이디/비밀번호 입력 (Figma P-01) */
function StoresUnlinkedFormMobile({
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  linkError,
  placeholderId,
  placeholderPw,
}: {
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  linkError: string | null;
  placeholderId: string;
  placeholderPw: string;
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <div className="mt-6 flex flex-col gap-5">
      {linkError ? (
        <p className="typo-body-02-regular text-red-01">{linkError}</p>
      ) : null}
      <label className="flex flex-col gap-3">
        <span className="typo-body-01-bold text-gray-01">아이디</span>
        <input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder={placeholderId}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-3">
        <span className="typo-body-01-bold text-gray-01">비밀번호</span>
        <div className="relative">
          <input
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={placeholderPw}
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            aria-label={passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"}
            onClick={() => setPasswordVisible((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-05 hover:text-gray-03"
          >
            {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
      </label>
    </div>
  );
}

export function StoresUnlinkedView({
  platform,
  platformLabel,
  descriptionLines,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  linkError,
  onLink,
  linking,
}: StoresUnlinkedViewProps) {
  return (
    <>
      {/* 모바일 */}
      <div className="flex flex-col px-4 pb-28 md:hidden">
        <div className="flex items-center gap-3 pt-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#1DA6A2] bg-white">
            <PlatformIcon platform={platform} />
          </div>
          <h2 className="typo-heading-02-bold text-gray-01">
            {platformLabel} 매장 연동
          </h2>
        </div>
        <p className="typo-body-02-regular mt-4 whitespace-pre-line text-gray-04">
          {descriptionLines[0]}
          {"\n"}
          {descriptionLines[1] ?? ""}
        </p>
        <StoresUnlinkedFormMobile
          username={username}
          onUsernameChange={onUsernameChange}
          password={password}
          onPasswordChange={onPasswordChange}
          linkError={linkError}
          placeholderId="아이디를 입력해주세요"
          placeholderPw="비밀번호를 입력해주세요"
        />
      </div>
      <PageFixedBottomBar className="px-4 md:hidden">
        <Button
          type="button"
          variant="primary"
          size="lg"
          className="h-[52px] w-full rounded-lg"
          onClick={onLink}
          disabled={linking || !username.trim() || !password}
        >
          {linking ? "연동 중…" : "매장 연동"}
        </Button>
      </PageFixedBottomBar>

      {/* 데스크톱 */}
      <div className="hidden min-h-[60vh] flex-col items-center justify-center md:flex">
        <Card padding="lg" className="w-full max-w-xl border-none">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-main-02 text-white">
                <PlatformIcon platform={platform} />
              </div>
              <h2 className="typo-heading-02-bold text-gray-01">
                {platformLabel} 매장 연동
              </h2>
            </div>
            <p className="typo-body-02-regular mt-3 text-gray-04">
              {descriptionLines[0]}
            </p>
            {descriptionLines[1] ? (
              <p className="typo-body-02-regular mt-1 text-gray-04">
                {descriptionLines[1]}
              </p>
            ) : null}
          </div>

          <PlatformLinkForm
            title=""
            description=""
            extra={null}
            successMessage={undefined}
            errorMessage={linkError}
            username={username}
            onUsernameChange={onUsernameChange}
            password={password}
            onPasswordChange={onPasswordChange}
            placeholderId="아이디를 입력해주세요"
            placeholderPw="비밀번호를 입력해주세요"
            onLink={onLink}
            linking={linking}
            noCard
            buttonText="매장 연동"
            variant="storeLink"
          />
        </Card>
      </div>
    </>
  );
}
