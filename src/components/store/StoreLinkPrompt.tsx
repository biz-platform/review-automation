"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export interface StoreLinkPromptProps {
  /** 안내 문구 (본문). typo-body-02로 표시 */
  message: string;
  /** 매장 연동하기 버튼 링크 */
  linkHref: string;
  /** 버튼 텍스트. 기본: 매장 연동하기 */
  linkLabel?: string;
  className?: string;
}

/**
 * 연동된 매장이 없을 때 안내 문구 + 매장 연동하기 버튼 배너.
 * 리뷰 관리, AI 댓글 설정 등에서 공통 사용.
 */
export function StoreLinkPrompt({
  message,
  linkHref,
  linkLabel = "매장 연동하기",
  className,
}: StoreLinkPromptProps) {
  return (
    <div
      className={
        className
          ? `rounded-lg border border-border bg-muted/50 p-6 text-center ${className}`
          : "mb-6 rounded-lg border border-border bg-muted/50 p-6 text-center"
      }
    >
      <p className="typo-body-02-regular mb-4 text-gray-02">{message}</p>
      <ButtonLink href={linkHref} variant="primary" size="md">
        {linkLabel}
      </ButtonLink>
    </div>
  );
}
