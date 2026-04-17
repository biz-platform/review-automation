"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useReviewListInfinite } from "@/entities/review/hooks/query/use-review-list-infinite";
import type { ReviewData } from "@/entities/review/types";
import {
  COUPANG_EATS_REPLY_WRITE_DEADLINE_DAYS,
  dedupeById,
} from "@/entities/review/lib/review-utils";
import type { PeriodFilterValue, StarRatingFilterValue } from "../constants";
import {
  PERIOD_FILTER_OPTIONS,
  parseStarFilterSearchParam,
} from "../constants";
import {
  buildNonBaeminReviewListNarrowing,
  parseStoreFilterList,
} from "./store-filter-utils";

function reviewMatchesStarFilter(
  ratingRaw: number | null,
  starFilter: StarRatingFilterValue,
): boolean {
  if (starFilter === "all") return true;
  const rating = ratingRaw != null ? Math.round(Number(ratingRaw)) : null;
  if (rating === null || Number.isNaN(rating)) return false;
  if (starFilter === "lte3") return rating >= 1 && rating <= 3;
  return String(rating) === starFilter;
}

function parseBaeminStoreSelection(value: string): {
  storeId: string | null;
  shopExternalId: string | null;
} {
  const v = value.trim();
  if (!v) return { storeId: null, shopExternalId: null };
  const parts = v.split(":");
  if (parts.length >= 3 && parts[1] === "baemin") {
    return {
      storeId: parts[0]?.trim() || null,
      shopExternalId: parts.slice(2).join(":").trim() || null,
    };
  }
  return { storeId: v, shopExternalId: null };
}

export function useReviewsManageList(
  isBaemin: boolean,
  effectiveStoreId: string | null,
  platform: string,
  linkedOnly: boolean,
  effectiveFilter: string,
  selectedStoreId: string,
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const starFilter = useMemo(
    () => parseStarFilterSearchParam(searchParams.get("star")),
    [searchParams],
  );

  const setStarFilter = useCallback(
    (value: StarRatingFilterValue) => {
      const q = new URLSearchParams(searchParams.toString());
      if (value === "all") q.delete("star");
      else q.set("star", value);
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>("all");

  const baeminSelection = parseBaeminStoreSelection(selectedStoreId);
  const isBaeminAllStores = isBaemin && selectedStoreId.trim() === "";
  const baeminStoreId = isBaeminAllStores
    ? null
    : (baeminSelection.storeId ?? effectiveStoreId);
  const baeminShopExternalId = baeminSelection.shopExternalId;

  const {
    data: baeminData,
    isLoading: baeminListLoading,
    fetchNextPage: fetchNextBaemin,
    hasNextPage: hasNextBaemin,
    isFetchingNextPage: isFetchingNextBaemin,
  } = useReviewListInfinite(
    isBaemin && (isBaeminAllStores || !!baeminStoreId)
      ? {
          ...(baeminStoreId ? { store_id: baeminStoreId } : {}),
          platform: "baemin",
          platform_shop_external_id: baeminShopExternalId ?? undefined,
          ...(baeminStoreId ? {} : { linked_only: true }),
          filter: effectiveFilter as
            | "all"
            | "unanswered"
            | "answered"
            | "expired",
          include_drafts: true,
        }
      : null,
  );

  const { data: baeminLowUnansweredData } = useReviewListInfinite(
    isBaemin && (isBaeminAllStores || !!baeminStoreId)
      ? {
          ...(baeminStoreId ? { store_id: baeminStoreId } : {}),
          platform: "baemin",
          platform_shop_external_id: baeminShopExternalId ?? undefined,
          ...(baeminStoreId ? {} : { linked_only: true }),
          filter: "unanswered",
          rating_lte: 3,
          include_drafts: false,
        }
      : null,
  );

  const nonBaeminListParams = useMemo(() => {
    const narrow = buildNonBaeminReviewListNarrowing({
      platformTab: platform,
      selectedStoreId,
    });
    return {
      ...narrow,
      filter: effectiveFilter as
        | "all"
        | "unanswered"
        | "answered"
        | "expired",
      include_drafts: true as const,
    };
  }, [platform, selectedStoreId, effectiveFilter]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useReviewListInfinite(!isBaemin ? nonBaeminListParams : null);

  const nonBaeminLowUnansweredParams = useMemo(() => {
    const narrow = buildNonBaeminReviewListNarrowing({
      platformTab: platform,
      selectedStoreId,
    });
    return {
      ...narrow,
      filter: "unanswered" as const,
      rating_lte: 3,
      include_drafts: false as const,
    };
  }, [platform, selectedStoreId]);

  const { data: lowUnansweredData } = useReviewListInfinite(
    !isBaemin ? nonBaeminLowUnansweredParams : null,
  );

  const baeminDbList = dedupeById(
    (isBaemin ? baeminData?.pages.flatMap((p) => p.result) : []) ?? [],
  );
  const list = dedupeById(data?.pages.flatMap((p) => p.result) ?? []);
  const countAll = isBaemin ? (baeminData?.pages[0]?.count ?? 0) : 0;
  const count = data?.pages[0]?.count ?? 0;
  const currentList = isBaemin ? baeminDbList : list;
  const hasLowRatingUnanswered = isBaemin
    ? ((baeminLowUnansweredData?.pages?.[0]?.count ?? 0) > 0)
    : ((lowUnansweredData?.pages?.[0]?.count ?? 0) > 0);

  const periodDays =
    PERIOD_FILTER_OPTIONS.find((p) => p.value === periodFilter)?.days ?? 180;
  const filteredList = useMemo(() => {
    const periodDaysForReview = (reviewPlatform: string | null | undefined) => {
      if (
        platform === "" &&
        periodFilter === "30" &&
        reviewPlatform === "coupang_eats"
      ) {
        return COUPANG_EATS_REPLY_WRITE_DEADLINE_DAYS;
      }
      return periodDays;
    };
    return currentList.filter((r: ReviewData) => {
      if (!isBaemin && selectedStoreId) {
        const targets = parseStoreFilterList(selectedStoreId);
        if (targets.length > 0) {
          const hit = targets.some(
            (t) =>
              r.store_id === t.storeId &&
              r.platform === t.platform &&
              (t.platformShopExternalId == null ||
                t.platformShopExternalId === "" ||
                (r.platform_shop_external_id ?? "") === t.platformShopExternalId),
          );
          if (!hit) return false;
        } else {
          const pairs = selectedStoreId.split(",").map((p) => p.trim());
          if (pairs.length === 1 && pairs[0] && !pairs[0].includes(":")) {
            if (r.store_id !== pairs[0]) return false;
          }
        }
      }
      if (r.written_at) {
        const days = periodDaysForReview(r.platform);
        const since = new Date();
        since.setDate(since.getDate() - days);
        const sinceStr = since.toISOString().slice(0, 10);
        if (r.written_at.slice(0, 10) < sinceStr) return false;
      }
      if (!reviewMatchesStarFilter(r.rating, starFilter)) return false;
      return true;
    });
  }, [currentList, periodFilter, periodDays, platform, starFilter, isBaemin, selectedStoreId]);

  return {
    baeminDbList,
    list,
    count,
    countAll,
    currentList,
    hasLowRatingUnanswered,
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
