"use client";

import { Button } from "@/components/ui/button";
import type { AdminCustomerFilterValue } from "@/entities/admin/types";
import { FILTER_OPTIONS } from "./constants";

export interface AdminCustomerFiltersProps {
  keyword: string;
  onKeywordChange: (v: string) => void;
  memberType: AdminCustomerFilterValue;
  onMemberTypeChange: (v: AdminCustomerFilterValue) => void;
  onSearch: () => void;
}

export function AdminCustomerFilters({
  keyword,
  onKeywordChange,
  memberType,
  onMemberTypeChange,
  onSearch,
}: AdminCustomerFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* 라벨 행: 고객 정보 | 회원 유형 (컨트롤과 열 맞춤) */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1 md:max-w-[280px]">
          <h2 className="typo-body-03-bold text-gray-01">고객 정보</h2>
        </div>
        <div className="min-w-[180px]">
          <h2 className="typo-body-03-bold text-gray-01">회원 유형</h2>
        </div>
      </div>
      {/* 컨트롤 행: input | select | 검색 (버튼은 input/select와 상단 정렬) */}
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <input
          type="text"
          placeholder="이메일 또는 휴대전화 번호"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="h-12 min-w-0 flex-1 rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none placeholder:text-gray-05 focus:border-main-02 focus:ring-1 focus:ring-main-02 md:max-w-[280px]"
        />
        <select
          value={memberType}
          onChange={(e) => {
            onMemberTypeChange(e.target.value as AdminCustomerFilterValue);
          }}
          className="h-12 min-w-[180px] rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="secondaryDark"
          size="lg"
          className="h-12 w-20 shrink-0 text-sm sm:w-24"
          onClick={onSearch}
        >
          검색
        </Button>
      </div>
    </div>
  );
}
