"use client";

import type { ReactNode } from "react";
import { Pagination } from "@/components/ui/pagination";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export interface SellerListSectionProps {
  /** 상단 카운트 문구 (예: "총 20건", "총 15명") */
  countLabel: string;
  loading?: boolean;
  /** 로딩이 아닐 때 목록 영역 (모바일 카드 + 데스크톱 테이블 등) */
  children: ReactNode;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * 셀러 관리 목록 섹션: 카운트 라벨, 로딩/목록, 페이지네이션(모바일 가운데 정렬).
 * 고객 관리·정산 관리 페이지에서 공통 사용.
 */
export function SellerListSection({
  countLabel,
  loading,
  children,
  page,
  totalPages,
  pageSize,
  onPageChange,
}: SellerListSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="typo-body-02-regular text-gray-01">{countLabel}</p>
      {loading ? (
        <ContentStateMessage
          variant="loading"
          message="불러오는 중…"
          className="min-h-40"
        />
      ) : (
        children
      )}
      <div className="flex flex-wrap items-center justify-center md:justify-end">
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
