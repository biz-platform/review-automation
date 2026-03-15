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
      platform?: string;
      linked_only?: boolean;
      include_drafts: true;
    }
  | null;

export function useReviewsManageFilterCounts(
  isBaemin: boolean,
  effectiveStoreId: string | null,
  platform: string,
  linkedOnly: boolean,
) {
  const countParamsBase = useMemo((): CountParamsBase => {
    if (isBaemin && effectiveStoreId)
      return {
        store_id: effectiveStoreId,
        platform: "baemin",
        include_drafts: true,
      };
    if (!isBaemin)
      return {
        platform: platform && platform !== "baemin" ? platform : undefined,
        linked_only: linkedOnly && platform !== "baemin",
        include_drafts: true,
      };
    return null;
  }, [isBaemin, effectiveStoreId, platform, linkedOnly]);

  const filterCountQueries = useQueries({
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
      enabled: countParamsBase != null,
    })),
  });

  const filterCounts = useMemo(
    () => ({
      all: filterCountQueries[0]?.data?.count ?? 0,
      unanswered: filterCountQueries[1]?.data?.count ?? 0,
      answered: filterCountQueries[2]?.data?.count ?? 0,
      expired: filterCountQueries[3]?.data?.count ?? 0,
    }),
    [
      filterCountQueries[0]?.data?.count,
      filterCountQueries[1]?.data?.count,
      filterCountQueries[2]?.data?.count,
      filterCountQueries[3]?.data?.count,
    ],
  );

  return { filterCounts };
}
