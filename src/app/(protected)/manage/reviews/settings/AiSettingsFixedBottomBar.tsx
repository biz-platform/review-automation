"use client";

import type { ReactNode } from "react";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { cn } from "@/lib/utils/cn";

/**
 * AI 댓글 설정 페이지 전용 하단 고정 바.
 * 모든 탭(우리 가게 맞춤 AI, 댓글 등록 등)에서 공통 사용.
 * PageFixedBottomBar를 감싸고, 설명 문구 + 액션(저장 버튼 등) 레이아웃을 제공.
 */
export function AiSettingsFixedBottomBar({
  className,
  children,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <PageFixedBottomBar
      className={cn(
        "w-full flex-row items-center gap-2",
        "px-4 md:pl-10 md:pr-15",
        "justify-center md:justify-between",
        className,
      )}
    >
      {children}
    </PageFixedBottomBar>
  );
}
