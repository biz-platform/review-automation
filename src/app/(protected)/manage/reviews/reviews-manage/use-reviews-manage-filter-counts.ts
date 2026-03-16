"use client";

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { getReviewList } from "@/entities/review/api/review-api";
import { REVIEW_FILTER_VALUES } from "../constants";

type CountParamsBase =
  | {
      store_id: string;
      platform: "baemin";
      include_drafts: true;
    }
  | {
      store_id?: string;
      platform?: string;
      linked_only?: boolean;
      include_drafts: true;
    }
  | null;

/** selectedStoreId가 "id1:ce,id2:dd" 형태일 때 [storeId, platform][] 로 파싱 */
function parseStoreFilter(selectedStoreId: string): [string, string][] {
  if (!selectedStoreId.trim()) return [];
  return selectedStoreId
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.includes(":"))
    .map((p) => {
      const i = p.indexOf(":");
      return [p.slice(0, i), p.slice(i + 1)] as [string, string];
    });
}

export function useReviewsManageFilterCounts(
  isBaemin: boolean,
  effectiveStoreId: string | null,
  platform: string,
  linkedOnly: boolean,
  selectedStoreId: string,
) {
  const storePairs = useMemo(
    () => (platform === "" ? parseStoreFilter(selectedStoreId) : []),
    [platform, selectedStoreId],
  );

  const countParamsBase = useMemo((): CountParamsBase => {
    if (isBaemin && effectiveStoreId)
      return {
        store_id: effectiveStoreId,
        platform: "baemin",
        include_drafts: true,
      };
    if (!isBaemin) {
      const singleStore =
        platform && selectedStoreId && !selectedStoreId.includes(",")
          ? selectedStoreId
          : undefined;
      return {
        store_id: singleStore,
        platform: platform && platform !== "baemin" ? platform : undefined,
        linked_only: !singleStore,
        include_drafts: true,
      };
    }
    return null;
  }, [isBaemin, effectiveStoreId, platform, linkedOnly, selectedStoreId]);

  const useMultiStore = platform === "" && storePairs.length > 0;

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
          limit: 1,
          offset: 0,
        }),
      enabled: countParamsBase != null && !useMultiStore,
    })),
  });

  const multiQueryFlatten = useQueries({
    queries: useMultiStore
      ? REVIEW_FILTER_VALUES.flatMap((filter) =>
          storePairs.map(([storeId, plat]) => ({
            queryKey: [
              "review",
              "list",
              "count",
              storeId,
              plat,
              filter,
            ] as const,
            queryFn: () =>
              getReviewList({
                store_id: storeId,
                platform: plat,
                filter,
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
