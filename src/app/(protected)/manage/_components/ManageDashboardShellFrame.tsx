"use client";

import type { ReactNode } from "react";

type ManageDashboardShellFrameProps = {
  filterRow: ReactNode;
  tabNav: ReactNode;
  rangeControl: ReactNode;
  children: ReactNode;
};

/** 회원 / 어드민 매장 대시보드 공통: 필터 행 + 탭 + 기간 + stone 띠 + 본문 */
export function ManageDashboardShellFrame({
  filterRow,
  tabNav,
  rangeControl,
  children,
}: ManageDashboardShellFrameProps) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {filterRow}
          </div>
        </div>

        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {tabNav}
          {/* 데스크톱용 기간 토글은 모바일에서는 숨김 (요구사항 #3) */}
          <div className="hidden shrink-0 self-end sm:block sm:self-auto sm:ml-auto">
            {rangeControl}
          </div>
        </div>
      </header>

      <div
        className="hidden h-2.5 w-full shrink-0 bg-stone-50 sm:block"
        aria-hidden
      />

      {children}
    </div>
  );
}
