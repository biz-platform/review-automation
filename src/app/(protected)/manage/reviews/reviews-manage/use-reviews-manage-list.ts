"use client";

import { useState, useMemo } from "react";
import { useReviewListInfinite } from "@/entities/review/hooks/query/use-review-list-infinite";
import type { ReviewData } from "@/entities/review/types";
import { dedupeById } from "@/entities/review/lib/review-utils";
import type { PeriodFilterValue, StarRatingFilterValue } from "../constants";
import { PERIOD_FILTER_OPTIONS } from "../constants";

export function useReviewsManageList(
  isBaemin: boolean,
  effectiveStoreId: string | null,
  platform: string,
  linkedOnly: boolean,
  effectiveFilter: string,
) {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>("all");
  const [starFilter, setStarFilter] = useState<StarRatingFilterValue>("all");

  const {
    data: baeminData,
    isLoading: baeminListLoading,
    fetchNextPage: fetchNextBaemin,
    hasNextPage: hasNextBaemin,
    isFetchingNextPage: isFetchingNextBaemin,
  } = useReviewListInfinite(
    isBaemin && effectiveStoreId
      ? {
          store_id: effectiveStoreId,
          platform: "baemin",
          filter: effectiveFilter as "all" | "unanswered" | "answered" | "expired",
          include_drafts: true,
        }
      : null,
  );

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useReviewListInfinite(
    !isBaemin
      ? {
          platform: platform && platform !== "baemin" ? platform : undefined,
          linked_only: linkedOnly && platform !== "baemin",
          filter: effectiveFilter as "all" | "unanswered" | "answered" | "expired",
          include_drafts: true,
        }
      : null,
  );

  const baeminDbList = dedupeById(
    (isBaemin ? baeminData?.pages.flatMap((p) => p.result) : []) ?? [],
  );
  const list = dedupeById(data?.pages.flatMap((p) => p.result) ?? []);
  const countAll = isBaemin ? (baeminData?.pages[0]?.count ?? 0) : 0;
  const count = data?.pages[0]?.count ?? 0;
  const currentList = isBaemin ? baeminDbList : list;

  const periodDays =
    PERIOD_FILTER_OPTIONS.find((p) => p.value === periodFilter)?.days ?? 180;
  const filteredList = useMemo(() => {
    const since = new Date();
    since.setDate(since.getDate() - periodDays);
    const sinceStr = since.toISOString().slice(0, 10);
    return currentList.filter((r: ReviewData) => {
      if (r.written_at && r.written_at.slice(0, 10) < sinceStr) return false;
      if (starFilter !== "all") {
        const rating = r.rating != null ? Math.round(Number(r.rating)) : null;
        if (rating === null || String(rating) !== starFilter) return false;
      }
      return true;
    });
  }, [currentList, periodFilter, periodDays, starFilter]);

  return {
    baeminDbList,
    list,
    count,
    countAll,
    currentList,
    filteredList,
    baeminListLoading,
    isLoading,
    hasNextBaemin,
    hasNextPage,
    isFetchingNextBaemin,
    isFetchingNextPage,
    fetchNextBaemin,
    fetchNextPage,
    periodFilter,
    setPeriodFilter,
    starFilter,
    setStarFilter,
  };
}
