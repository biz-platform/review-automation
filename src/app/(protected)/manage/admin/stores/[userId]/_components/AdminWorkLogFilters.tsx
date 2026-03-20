"use client";

import { DateRangeFilter } from "@/components/shared/DateRangeFilter";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "sync", label: "동기화" },
  { value: "register_reply", label: "답글 등록" },
  { value: "link", label: "연동" },
  { value: "modify_delete", label: "수정·삭제" },
  { value: "other", label: "기타" },
];

const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "baemin", label: "배민" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "yogiyo", label: "요기요" },
  { value: "ddangyo", label: "땡겨요" },
];

export type WorkLogStatusFilter = "all" | "completed" | "failed";

export interface AdminWorkLogFiltersProps {
  storeOptions: { value: string; label: string }[];
  storeId: string;
  onStoreIdChange: (v: string) => void;
  platform: string;
  onPlatformChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  statusFilter: WorkLogStatusFilter;
  onStatusFilterChange: (v: WorkLogStatusFilter) => void;
}

export function AdminWorkLogFilters({
  storeOptions,
  storeId,
  onStoreIdChange,
  platform,
  onPlatformChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  category,
  onCategoryChange,
  statusFilter,
  onStatusFilterChange,
}: AdminWorkLogFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="typo-body-03-bold text-gray-01">매장</label>
          <select
            value={storeId}
            onChange={(e) => onStoreIdChange(e.target.value)}
            className="h-12 min-w-[140px] rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02"
          >
            <option value="">전체</option>
            {storeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="typo-body-03-bold text-gray-01">플랫폼</label>
          <select
            value={platform}
            onChange={(e) => onPlatformChange(e.target.value)}
            className="h-12 min-w-[120px] rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02"
          >
            {PLATFORM_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={onDateFromChange}
          onDateToChange={onDateToChange}
          showLabel={true}
          className="flex items-center gap-2"
        />
        <div className="flex flex-col gap-1">
          <label className="typo-body-03-bold text-gray-01">카테고리</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="h-12 min-w-[120px] rounded-lg border border-gray-07 bg-white px-4 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value || "all"} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onStatusFilterChange("all")}
          className={`rounded-lg px-4 py-2 typo-body-03-bold ${
            statusFilter === "all"
              ? "bg-gray-02 text-white"
              : "border border-gray-07 bg-white text-gray-01"
          }`}
        >
          전체
        </button>
        <button
          type="button"
          onClick={() => onStatusFilterChange("completed")}
          className={`rounded-lg px-4 py-2 typo-body-03-bold ${
            statusFilter === "completed"
              ? "bg-gray-02 text-white"
              : "border border-gray-07 bg-white text-gray-01"
          }`}
        >
          성공
        </button>
        <button
          type="button"
          onClick={() => onStatusFilterChange("failed")}
          className={`rounded-lg px-4 py-2 typo-body-03-bold ${
            statusFilter === "failed"
              ? "bg-gray-02 text-white"
              : "border border-gray-07 bg-white text-gray-01"
          }`}
        >
          오류
        </button>
      </div>
    </div>
  );
}
