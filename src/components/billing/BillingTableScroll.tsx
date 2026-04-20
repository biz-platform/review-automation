import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** 회원·어드민 결제 테이블 공통: 가로 스크롤 + 테두리 */
export function BillingTableScroll({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-x-auto rounded-lg border border-gray-07",
        className,
      )}
    >
      {children}
    </div>
  );
}
