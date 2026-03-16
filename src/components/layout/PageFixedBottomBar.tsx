"use client";

import { cn } from "@/lib/utils/cn";

/**
 * 페이지 하단 고정 액션 영역. 패딩·레이아웃은 className으로 호출처에서 지정.
 * - 모바일 공통: px-4
 * - 데스크톱 리뷰 관리 계열: pl-10 pr-15
 * - 데스크톱 매장 관리: pr-15
 */
export function PageFixedBottomBar({
  className,
  children,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-07 bg-white pt-6 pb-10 lg:left-[var(--width-lnb)] shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <div className={cn("flex", className)}>{children}</div>
    </div>
  );
}
