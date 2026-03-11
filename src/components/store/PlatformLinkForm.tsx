"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

export interface PlatformLinkFormProps {
  title: string;
  description: string;
  extra?: ReactNode;
  successMessage?: string;
  errorMessage?: string | null;
  username: string;
  onUsernameChange: (value: string) => void;
  password: string;
  onPasswordChange: (value: string) => void;
  placeholderId?: string;
  placeholderPw?: string;
  onLink: () => void;
  linking: boolean;
  /** true면 Card 없이 section만 렌더 (상위에서 카드로 감쌀 때 사용) */
  noCard?: boolean;
  /** 버튼 문구 (기본: "연동하기(로그인)") */
  buttonText?: string;
  /** 매장 연동 페이지용: 라벨/입력 간격·버튼 스타일·비밀번호 표시 토글 */
  variant?: "default" | "storeLink";
}

export function PlatformLinkForm({
  title,
  description,
  extra,
  successMessage,
  errorMessage,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  placeholderId = "아이디",
  placeholderPw = "비밀번호",
  onLink,
  linking,
  noCard,
  buttonText = "연동하기(로그인)",
  variant = "default",
}: PlatformLinkFormProps) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const isStoreLink = variant === "storeLink";

  const labelClass = isStoreLink
    ? "typo-body-02-bold mb-3 block text-gray-01"
    : "mb-1 block text-sm font-medium";
  const inputClass = isStoreLink
    ? "h-12 w-full rounded-lg border border-gray-07 bg-white pl-4 pr-4 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none focus:border-gray-03 focus:ring-1 focus:ring-gray-03"
    : "w-full rounded-md border border-border px-3 py-2";
  const passwordInputClass = isStoreLink
    ? "h-12 w-full rounded-lg border border-gray-07 bg-white pl-4 pr-12 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none focus:border-gray-03 focus:ring-1 focus:ring-gray-03"
    : "w-full rounded-md border border-border px-3 py-2";

  const content = (
    <section>
      {title ? <h2 className="mb-4 text-lg font-bold">{title}</h2> : null}
      {extra}
      {description ? (
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      ) : null}
      {successMessage && (
        <p className="mb-4 text-sm text-green-600">{successMessage}</p>
      )}
      {errorMessage && (
        <p className="mb-4 text-sm text-red-600">{errorMessage}</p>
      )}
      <div className={cn(isStoreLink ? "space-y-5" : "space-y-4")}>
        <label className="block">
          <span className={labelClass}>아이디</span>
          <input
            type="text"
            value={username}
            onChange={(e) => onUsernameChange(e.target.value)}
            placeholder={placeholderId}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>비밀번호</span>
          <div className="relative">
            <input
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder={placeholderPw}
              className={passwordInputClass}
            />
            {isStoreLink && (
              <button
                type="button"
                aria-label={
                  passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기"
                }
                onClick={() => setPasswordVisible((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-05 hover:text-gray-03"
              >
                {passwordVisible ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            )}
          </div>
        </label>
        <Button
          type="button"
          variant="primary"
          size="lg"
          fullWidth
          className={isStoreLink ? "mt-24" : undefined}
          onClick={onLink}
          disabled={linking || !username.trim() || !password}
        >
          {linking ? "연동 중…" : buttonText}
        </Button>
      </div>
    </section>
  );
  return noCard ? (
    <div className="max-w-md">{content}</div>
  ) : (
    <Card padding="lg" className="max-w-md">
      {content}
    </Card>
  );
}

function EyeIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
      />
    </svg>
  );
}
