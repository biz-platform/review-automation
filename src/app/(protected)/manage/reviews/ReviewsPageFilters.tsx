"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { TagSelect } from "@/components/ui/tag-select";
import { OptionItem } from "@/components/ui/option-item";
import {
  REVIEW_FILTER_TABS,
  PERIOD_FILTER_OPTIONS,
  STAR_RATING_OPTIONS,
} from "@/app/(protected)/manage/reviews/constants";
import dateIcon from "@/assets/icons/24px/date.webp";
import starIcon from "@/assets/icons/24px/star.webp";
import type { ReviewData, ReviewListFilter } from "@/entities/review/types";

export interface ReviewsPageFiltersProps {
  showReviewLoadingBanner: boolean;
  storeFilterOptions: { value: string; label: string }[];
  selectedStoreId: string;
  onSelectedStoreIdChange: (id: string) => void;
  periodFilter: (typeof PERIOD_FILTER_OPTIONS)[number]["value"];
  onPeriodFilterChange: (
    value: (typeof PERIOD_FILTER_OPTIONS)[number]["value"],
  ) => void;
  starFilter: (typeof STAR_RATING_OPTIONS)[number]["value"];
  onStarFilterChange: (
    value: (typeof STAR_RATING_OPTIONS)[number]["value"],
  ) => void;
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

  const [periodOpen, setPeriodOpen] = useState(false);
  const [starOpen, setStarOpen] = useState(false);

  const unansweredInView = filteredList.filter((r) => isReviewUnanswered(r));
  const hasUnansweredInView = unansweredInView.length > 0;
  const allUnansweredSelected =
    hasUnansweredInView &&
    unansweredInView.every((r) => selectedReviewIds.has(r.id));

  return (
    <>
      <div className="mb-4 flex flex-nowrap items-center justify-between gap-2 md:flex-wrap">
        <MaskedNativeSelect
          uiSize="smBody02"
          wrapperClassName="min-w-[108px] flex-1 md:min-w-[140px] md:flex-none"
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
        </MaskedNativeSelect>
        <div className="flex flex-nowrap items-center gap-2">
          <DropdownRoot open={periodOpen} onOpenChange={setPeriodOpen}>
            <div className="hidden md:block">
              <DropdownTrigger
                icon={<Image src={dateIcon} alt="" width={24} height={24} />}
              >
                {PERIOD_FILTER_OPTIONS.find((o) => o.value === periodFilter)
                  ?.label ?? "전체 (최근 6개월)"}
              </DropdownTrigger>
            </div>
            <button
              type="button"
              aria-label="기간 선택"
              aria-expanded={periodOpen}
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex h-[38px] w-[48px] items-center justify-center rounded-lg border border-gray-07 bg-white md:hidden"
            >
              <Image src={dateIcon} alt="" width={24} height={24} />
            </button>
            <DropdownContent className="right-0 left-auto min-w-[200px]">
              {PERIOD_FILTER_OPTIONS.map((opt) => (
                <DropdownItem
                  key={opt.value}
                  onSelect={() => onPeriodFilterChange(opt.value)}
                  className={
                    periodFilter === opt.value ? "bg-gray-08" : undefined
                  }
                >
                  {opt.label}
                </DropdownItem>
              ))}
            </DropdownContent>
          </DropdownRoot>

          <DropdownRoot open={starOpen} onOpenChange={setStarOpen}>
            <div className="hidden md:block">
              <DropdownTrigger
                icon={<Image src={starIcon} alt="" width={24} height={24} />}
              >
                {STAR_RATING_OPTIONS.find((o) => o.value === starFilter)
                  ?.label ?? "별점 전체"}
              </DropdownTrigger>
            </div>
            <button
              type="button"
              aria-label="별점 선택"
              aria-expanded={starOpen}
              onClick={() => setStarOpen(!starOpen)}
              className="flex h-[38px] w-[48px] items-center justify-center rounded-lg border border-gray-07 bg-white md:hidden"
            >
              <Image src={starIcon} alt="" width={24} height={24} />
            </button>
            <DropdownContent className="right-0 left-auto min-w-[200px]">
              {STAR_RATING_OPTIONS.map((opt) => (
                <DropdownItem
                  key={opt.value}
                  onSelect={() => onStarFilterChange(opt.value)}
                  className={
                    starFilter === opt.value ? "bg-gray-08" : undefined
                  }
                >
                  {opt.label}
                </DropdownItem>
              ))}
            </DropdownContent>
          </DropdownRoot>
        </div>
      </div>

      <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
        {REVIEW_FILTER_TABS.map((tab) => {
          const n = filterCounts[tab.value];
          return (
            <Link key={tab.value} href={filterHref(tab.value)}>
              <TagSelect
                variant={effectiveFilter === tab.value ? "checked" : "default"}
              >
                <span className="md:hidden">{`${tab.label}(${n})`}</span>
                <span className="hidden md:inline">{`${tab.label} ${n}개`}</span>
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
