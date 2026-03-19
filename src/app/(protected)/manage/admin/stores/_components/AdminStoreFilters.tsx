"use client";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Button } from "@/components/ui/button";
import { REGISTRATION_METHOD_OPTIONS } from "./constants";

export type AdminStoreRegistrationMethodFilter = "all" | "direct" | "auto";

export interface AdminStoreFiltersProps {
  keyword: string;
  onKeywordChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  registrationMethod: AdminStoreRegistrationMethodFilter;
  onRegistrationMethodChange: (v: AdminStoreRegistrationMethodFilter) => void;
  onSearch: () => void;
}

export function AdminStoreFilters({
  keyword,
  onKeywordChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  registrationMethod,
  onRegistrationMethodChange,
  onSearch,
}: AdminStoreFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* 라벨 행: 고객 정보 | 기간 | 등록방법 (고객 관리와 동일, 열 맞춤) */}
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1 md:max-w-[280px]">
          <h2 className="typo-body-03-bold text-gray-01">고객 정보</h2>
        </div>
        <div className="w-[292px] shrink-0">
          <h2 className="typo-body-03-bold text-gray-01">기간</h2>
        </div>
        <div className="w-[140px] shrink-0">
          <h2 className="typo-body-03-bold text-gray-01">등록방법</h2>
        </div>
      </div>
      {/* 컨트롤 행: input | date~date | select | 검색 */}
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <input
          type="text"
          placeholder="이메일 또는 매장 이름"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="h-12 min-w-0 flex-1 rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none placeholder:text-gray-05 focus:border-main-02 focus:ring-1 focus:ring-main-02 md:max-w-[280px]"
        />
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          showLabel={false}
          className="flex w-[292px] shrink-0 items-center gap-2"
        />
        <select
          value={registrationMethod}
          onChange={(e) =>
            onRegistrationMethodChange(e.target.value as AdminStoreRegistrationMethodFilter)
          }
          className="h-12 w-[140px] shrink-0 rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02"
        >
          {REGISTRATION_METHOD_OPTIONS.map((opt) => (
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
