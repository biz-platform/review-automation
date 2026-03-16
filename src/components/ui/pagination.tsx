"use client";

import { Button } from "@/components/ui/button";

export type PaginationProps = {
  /** 현재 페이지 (1-based) */
  page: number;
  /** 전체 페이지 수 */
  totalPages: number;
  /** 페이지당 개수 (라벨 "N개씩 보여요" 표시용) */
  pageSize: number;
  /** 페이지 변경 시 호출 */
  onPageChange: (page: number) => void;
  /** 네비게이션 aria-label */
  ariaLabel?: string;
};

/**
 * 테이블/리스트 하단 페이지네이션. 고객 관리·정산 관리 등에서 공통 사용.
 */
export function Pagination({
  page,
  totalPages,
  pageSize,
  onPageChange,
  ariaLabel = "페이지 네비게이션",
}: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end">
      <div className="flex items-center gap-3">
        <span className="hidden typo-body-03-regular text-gray-05 md:inline">
          {pageSize}개씩 보여요
        </span>
        <nav className="flex items-center gap-1" aria-label={ariaLabel}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-9 h-9 shrink-0 p-0 text-gray-05 hover:text-gray-01"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="이전 페이지"
          >
            ←
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              type="button"
              variant={p === page ? "secondaryDark" : "ghost"}
              size="sm"
              className={
                p === page
                  ? "min-w-9 h-9 shrink-0 p-0 text-sm"
                  : "min-w-9 h-9 shrink-0 p-0 text-sm text-gray-05 hover:text-gray-01"
              }
              onClick={() => onPageChange(p)}
            >
              {p}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-9 h-9 shrink-0 p-0 text-gray-05 hover:text-gray-01"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="다음 페이지"
          >
            →
          </Button>
        </nav>
      </div>
    </div>
  );
}
