"use client";

import { useState, useMemo } from "react";
import { useReviewListInfinite } from "@/entities/review/hooks/query/use-review-list-infinite";
import type { ReviewData } from "@/entities/review/types";
import { dedupeById } from "@/entities/review/lib/review-utils";
import type { PeriodFilterValue, StarRatingFilterValue } from "../constants";
import { PERIOD_FILTER_OPTIONS } from "../constants";
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
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterValue>("all");
  const [starFilter, setStarFilter] = useState<StarRatingFilterValue>("all");

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
      if (r.written_at && r.written_at.slice(0, 10) < sinceStr) return false;
      if (starFilter !== "all") {
        const rating = r.rating != null ? Math.round(Number(r.rating)) : null;
        if (rating === null || String(rating) !== starFilter) return false;
      }
      return true;
    });
  }, [currentList, periodFilter, periodDays, starFilter, isBaemin, selectedStoreId]);

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
