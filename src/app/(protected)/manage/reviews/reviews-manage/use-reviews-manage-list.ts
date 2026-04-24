"use client";

import { useMemo, useCallback, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useReviewListInfinite } from "@/entities/review/hooks/query/use-review-list-infinite";
import type { ReviewData } from "@/entities/review/types";
import { dedupeById } from "@/entities/review/lib/review-utils";
import type { PeriodFilterValue, StarRatingFilterValue } from "../constants";
import {
  PERIOD_FILTER_OPTIONS,
  parseStarFilterSearchParam,
} from "../constants";
import {
  buildNonBaeminReviewListNarrowing,
  parseStoreFilterList,
} from "./store-filter-utils";

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
  const periodDays =
    PERIOD_FILTER_OPTIONS.find((p) => p.value === periodFilter)?.days ?? 180;
  const ratingEq =
    starFilter === "5" || starFilter === "4" ? Number(starFilter) : undefined;
  const ratingLte = starFilter === "lte3" ? 3 : undefined;

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
          period_days: periodDays,
          ...(ratingEq != null ? { rating_eq: ratingEq } : {}),
          ...(ratingLte != null ? { rating_lte: ratingLte } : {}),
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
          period_days: periodDays,
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
      period_days: periodDays,
      ...(ratingEq != null ? { rating_eq: ratingEq } : {}),
      ...(ratingLte != null ? { rating_lte: ratingLte } : {}),
    };
  }, [platform, selectedStoreId, effectiveFilter, periodDays, ratingEq, ratingLte]);

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
      period_days: periodDays,
    };
  }, [platform, selectedStoreId, periodDays]);

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

  const filteredList = useMemo(() => {
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
      return true;
    });
  }, [currentList, isBaemin, selectedStoreId]);

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
