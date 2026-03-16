"use client";

import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

export interface SellerListCardProps {
  /** 카드 상단 제목 (예: 이메일). 없으면 생략 */
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * 셀러 관리 모바일 카드 컨테이너. 고객 관리·정산 관리 모바일 목록에서 공통 사용.
 */
export function SellerListCard({ title, children, className }: SellerListCardProps) {
  return (
    <div
      className={cn(
        "flex min-h-52 w-full flex-col gap-4 rounded-lg border border-gray-07 bg-white p-4",
        className,
      )}
    >
      {title != null && (
        <p className="text-base font-semibold leading-6 text-gray-01">{title}</p>
      )}
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export interface SellerListCardRowProps {
  label: string;
  value: ReactNode;
  /** 값 셀에 적용할 추가 className (예: 정산 금액 강조 text-main-02) */
  valueClassName?: string;
}

/**
 * 카드 내 한 행: 레이블(좌) + 값(우).
 */
export function SellerListCardRow({
  label,
  value,
  valueClassName,
}: SellerListCardRowProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-sm font-medium leading-6 text-gray-01">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-sm font-medium leading-6 text-gray-02",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
