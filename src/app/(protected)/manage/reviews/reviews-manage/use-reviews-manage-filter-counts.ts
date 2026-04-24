"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getReviewList } from "@/entities/review/api/review-api";
import { PERIOD_FILTER_OPTIONS, REVIEW_FILTER_VALUES, type PeriodFilterValue, type StarRatingFilterValue } from "../constants";
import {
  buildNonBaeminReviewListNarrowing,
  parseStoreFilterList,
} from "./store-filter-utils";

type CountParamsBase =
  | {
      store_id: string;
      platform: "baemin";
      platform_shop_external_id?: string;
      include_drafts: true;
    }
  | {
      platform: "baemin";
      linked_only: true;
      include_drafts: true;
    }
  | {
      store_id?: string;
      platform?: string;
      linked_only?: boolean;
      include_drafts: true;
    }
  | null;

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

export function useReviewsManageFilterCounts(
  isBaemin: boolean,
  effectiveStoreId: string | null,
  platform: string,
  linkedOnly: boolean,
  selectedStoreId: string,
  periodFilter: PeriodFilterValue,
  starFilter: StarRatingFilterValue,
) {
  const storePairs = useMemo(
    () => (platform === "" ? parseStoreFilterList(selectedStoreId) : []),
    [platform, selectedStoreId],
  );

  const countParamsBase = useMemo((): CountParamsBase => {
    if (isBaemin) {
      if (selectedStoreId.trim() === "") {
        return {
          platform: "baemin",
          linked_only: true,
          include_drafts: true,
        };
      }
      if (!effectiveStoreId) return null;
      const parsed = parseBaeminStoreSelection(selectedStoreId);
      return {
        store_id: parsed.storeId ?? effectiveStoreId,
        platform: "baemin",
        platform_shop_external_id: parsed.shopExternalId ?? undefined,
        include_drafts: true,
      };
    }
    if (!isBaemin) {
      const narrow = buildNonBaeminReviewListNarrowing({
        platformTab: platform,
        selectedStoreId,
      });
      return {
        ...narrow,
        include_drafts: true,
      };
    }
    return null;
  }, [isBaemin, effectiveStoreId, platform, linkedOnly, selectedStoreId]);

  const periodDays =
    PERIOD_FILTER_OPTIONS.find((p) => p.value === periodFilter)?.days ?? 180;
  const ratingEq =
    starFilter === "5" || starFilter === "4" ? Number(starFilter) : undefined;
  const ratingLte = starFilter === "lte3" ? 3 : undefined;

  const useMultiStore = platform === "" && storePairs.length > 1;

  const singleQueries = useQueries({
    queries: REVIEW_FILTER_VALUES.map((filter) => ({
      queryKey: [
        "review",
        "list",
        "count",
        countParamsBase ?? "disabled",
        filter,
      ],
      queryFn: () =>
        getReviewList({
          ...countParamsBase!,
          filter,
          period_days: periodDays,
          ...(ratingEq != null ? { rating_eq: ratingEq } : {}),
          ...(ratingLte != null ? { rating_lte: ratingLte } : {}),
          limit: 1,
          offset: 0,
        }),
      enabled: countParamsBase != null && !useMultiStore,
    })),
  });

  const multiQueryFlatten = useQueries({
    queries: useMultiStore
      ? REVIEW_FILTER_VALUES.flatMap((filter) =>
          storePairs.map((t) => ({
            queryKey: [
              "review",
              "list",
              "count",
              t.storeId,
              t.platform,
              t.platformShopExternalId ?? "",
              filter,
            ] as const,
            queryFn: () =>
              getReviewList({
                store_id: t.storeId,
                platform: t.platform,
                platform_shop_external_id: t.platformShopExternalId,
                filter,
                period_days: periodDays,
                ...(ratingEq != null ? { rating_eq: ratingEq } : {}),
                ...(ratingLte != null ? { rating_lte: ratingLte } : {}),
                limit: 1,
                offset: 0,
                include_drafts: true,
              }),
            enabled: true,
          })),
        )
      : [],
  });

  const filterCounts = useMemo(() => {
    if (useMultiStore && storePairs.length > 0) {
      const perFilter = REVIEW_FILTER_VALUES.map((filter, idx) => {
        const start = idx * storePairs.length;
        return multiQueryFlatten
          .slice(start, start + storePairs.length)
          .reduce((sum, q) => sum + (q.data?.count ?? 0), 0);
      });
      return {
        all: perFilter[0] ?? 0,
        unanswered: perFilter[1] ?? 0,
        answered: perFilter[2] ?? 0,
        expired: perFilter[3] ?? 0,
      };
    }
    return {
      all: singleQueries[0]?.data?.count ?? 0,
      unanswered: singleQueries[1]?.data?.count ?? 0,
      answered: singleQueries[2]?.data?.count ?? 0,
      expired: singleQueries[3]?.data?.count ?? 0,
    };
  }, [
    useMultiStore,
    storePairs.length,
    multiQueryFlatten,
    singleQueries[0]?.data?.count,
    singleQueries[1]?.data?.count,
    singleQueries[2]?.data?.count,
    singleQueries[3]?.data?.count,
  ]);

  return { filterCounts };
}
