"use client";

import type { ReactNode } from "react";

export interface SellerListFilterRowProps {
  /** 상단 레이블 (예: "고객 정보") */
  label?: string;
  children: ReactNode;
}

/**
 * 셀러 관리 목록 필터: 고객 정보 - 기간 - 검색 등이 한 행에 배치되는 레이아웃.
 * 고객 관리·정산 관리 페이지에서 공통 사용.
 */
export function SellerListFilterRow({ label, children }: SellerListFilterRowProps) {
  return (
    <div className="flex flex-col gap-2">
      {label != null && (
        <h2 className="typo-body-03-bold text-gray-01">{label}</h2>
      )}
      <div className="flex min-w-0 flex-nowrap items-center gap-3">
        {children}
      </div>
    </div>
  );
}
