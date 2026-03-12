"use client";
import { cn } from "@/lib/utils/cn";
/**
 * 페이지 하단 고정 액션 영역. 매장 관리(리뷰 관리하기), AI 댓글 설정(저장하기) 등에서 공통 사용.
 * SNB 제외 main 영역 너비에 맞춤.
 */
export function PageFixedBottomBar({
  className,
  children,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-07 bg-white pt-6 pb-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] md:left-(--width-lnb)">
      <div
        className={cn(
          "mx-auto flex max-w-full justify-end pl-(--layout-content-padding-left) pr-(--layout-content-padding-right) w-(--layout-content-width)",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
