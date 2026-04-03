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
      // 서버가 has_more / next_offset을 내려주면 그걸 우선 사용 (offset 폭주/끝판정 안정화)
      const anyLast = lastPage as unknown as {
        result: unknown[];
        has_more?: boolean;
        next_offset?: number;
        count?: number;
      };
      if (typeof anyLast.has_more === "boolean" && typeof anyLast.next_offset === "number") {
        return anyLast.has_more ? anyLast.next_offset : undefined;
      }

      // fallback: 마지막 페이지가 PAGE_SIZE보다 작으면 끝
      const loaded = allPages.reduce((acc, p) => acc + p.result.length, 0);
      if (lastPage.result.length < PAGE_SIZE) return undefined;
      return loaded;
    },
    enabled: params !== null,
  });
}
