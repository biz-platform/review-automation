"use client";

import Link from "next/link";
import { TagSelect } from "@/components/ui/tag-select";
import { OptionItem } from "@/components/ui/option-item";
import {
  REVIEW_FILTER_TABS,
  PERIOD_FILTER_OPTIONS,
  STAR_RATING_OPTIONS,
} from "@/app/(protected)/manage/reviews/constants";
import type {
  ReviewData,
  ReviewListFilter,
} from "@/entities/review/types";

export interface ReviewsPageFiltersProps {
  showReviewLoadingBanner: boolean;
  storeFilterOptions: { value: string; label: string }[];
  selectedStoreId: string;
  onSelectedStoreIdChange: (id: string) => void;
  periodFilter: (typeof PERIOD_FILTER_OPTIONS)[number]["value"];
  onPeriodFilterChange: (value: (typeof PERIOD_FILTER_OPTIONS)[number]["value"]) => void;
  starFilter: (typeof STAR_RATING_OPTIONS)[number]["value"];
  onStarFilterChange: (value: (typeof STAR_RATING_OPTIONS)[number]["value"]) => void;
  filterCounts: Record<ReviewListFilter, number>;
  filterHref: (filterValue: string) => string;
  effectiveFilter: string;
  filteredList: ReviewData[];
  isReviewUnanswered: (review: ReviewData) => boolean;
  selectedReviewIds: Set<string>;
  onSelectAllUnanswered: () => void;
}

export function ReviewsPageFilters({
  showReviewLoadingBanner,
  storeFilterOptions,
  selectedStoreId,
  onSelectedStoreIdChange,
  periodFilter,
  onPeriodFilterChange,
  starFilter,
  onStarFilterChange,
  filterCounts,
  filterHref,
  effectiveFilter,
  filteredList,
  isReviewUnanswered,
  selectedReviewIds,
  onSelectAllUnanswered,
}: ReviewsPageFiltersProps) {
  if (showReviewLoadingBanner) {
    return null;
  }

  const unansweredInView = filteredList.filter((r) =>
    isReviewUnanswered(r),
  );
  const hasUnansweredInView = unansweredInView.length > 0;
  const allUnansweredSelected =
    hasUnansweredInView &&
    unansweredInView.every((r) => selectedReviewIds.has(r.id));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <select
          className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01 min-w-[140px]"
          value={selectedStoreId}
          onChange={(e) => onSelectedStoreIdChange(e.target.value)}
          aria-label="업체별 필터"
          disabled={storeFilterOptions.length <= 1}
        >
          {storeFilterOptions.map((opt) => (
            <option key={opt.value || "all"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01"
            value={periodFilter}
            onChange={(e) =>
              onPeriodFilterChange(
                e.target.value as (typeof PERIOD_FILTER_OPTIONS)[number]["value"],
              )
            }
          >
            {PERIOD_FILTER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01"
            value={starFilter}
            onChange={(e) =>
              onStarFilterChange(
                e.target.value as (typeof STAR_RATING_OPTIONS)[number]["value"],
              )
            }
          >
            {STAR_RATING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
        {REVIEW_FILTER_TABS.map((tab) => {
          const n = filterCounts[tab.value];
          const label = `${tab.label} ${n}개`;
          return (
            <Link key={tab.value} href={filterHref(tab.value)}>
              <TagSelect
                variant={effectiveFilter === tab.value ? "checked" : "default"}
              >
                {label}
              </TagSelect>
            </Link>
          );
        })}
      </div>

      {(effectiveFilter === "all" || effectiveFilter === "unanswered") &&
        hasUnansweredInView && (
        <div className="mb-4">
          <OptionItem
            variant={allUnansweredSelected ? "checked" : "default"}
            onClick={onSelectAllUnanswered}
          >
            미답변 리뷰 전체 선택
          </OptionItem>
        </div>
      )}
    </>
  );
}
