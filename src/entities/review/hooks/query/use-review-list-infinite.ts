"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getReviewList } from "@/entities/review/api/review-api";
import type { ReviewListApiRequestData } from "@/entities/review/types";

const PAGE_SIZE = 10;

type BaseParams = Omit<ReviewListApiRequestData, "offset">;

export function useReviewListInfinite(params: BaseParams | null) {
  const baseKey = params !== null ? QUERY_KEY.review.list(params) : ["review", "list", "disabled"];
  return useInfiniteQuery({
    queryKey: [...baseKey, "infinite"],
    queryFn: ({ pageParam }) =>
      getReviewList({
        ...params,
        limit: PAGE_SIZE,
        offset: pageParam as number,
      } as ReviewListApiRequestData),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((acc, p) => acc + p.result.length, 0);
      if (lastPage.result.length < PAGE_SIZE) return undefined;
      return loaded;
    },
    enabled: params !== null,
  });
}
