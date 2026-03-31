"use client";

import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import { Button } from "@/components/ui/button";
import type { AdminSellerTypeFilter } from "@/entities/admin/types";
import { SELLER_TYPE_FILTER_OPTIONS } from "./constants";

export interface AdminSellerFiltersProps {
  keyword: string;
  onKeywordChange: (v: string) => void;
  sellerType: AdminSellerTypeFilter;
  onSellerTypeChange: (v: AdminSellerTypeFilter) => void;
  onSearch: () => void;
}

export function AdminSellerFilters({
  keyword,
  onKeywordChange,
  sellerType,
  onSellerTypeChange,
  onSearch,
}: AdminSellerFiltersProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0 flex-1 md:max-w-[280px]">
          <h2 className="typo-body-03-bold text-gray-01">셀러 정보</h2>
        </div>
        <div className="min-w-[180px]">
          <h2 className="typo-body-03-bold text-gray-01">셀러 유형</h2>
        </div>
      </div>
      <div className="flex min-w-0 flex-wrap items-start gap-3">
        <input
          type="text"
          placeholder="이름 또는 휴대전화 번호"
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearch()}
          className="h-12 min-w-0 flex-1 rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none placeholder:text-gray-05 focus:border-main-02 focus:ring-1 focus:ring-main-02 md:max-w-[280px]"
        />
        <MaskedNativeSelect
          value={sellerType}
          onChange={(e) => {
            onSellerTypeChange(e.target.value as AdminSellerTypeFilter);
          }}
          wrapperClassName="min-w-[180px]"
        >
          {SELLER_TYPE_FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </MaskedNativeSelect>
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
