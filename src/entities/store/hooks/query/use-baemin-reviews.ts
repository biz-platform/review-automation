"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import type { BaeminReviewSummaryResult } from "@/entities/store/api/store-api";
import {
  getBaeminReviewCount,
  getBaeminReviewList,
  getBaeminReviewSummary,
} from "@/entities/store/api/store-api";

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setMonth(from.getMonth() - 6);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function useBaeminReviewCount(
  storeId: string | null,
  from?: string,
  to?: string
) {
  const range = defaultDateRange();
  const f = from ?? range.from;
  const t = to ?? range.to;
  return useQuery({
    queryKey: QUERY_KEY.store.baeminReviewCount(storeId ?? "", f, t),
    queryFn: () =>
      storeId != null ? getBaeminReviewCount({ storeId, from: f, to: t }) : Promise.reject(new Error("no store")),
    enabled: !!storeId,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      const msg = String((error as Error)?.message ?? "");
      if (msg.includes("429") || msg.includes("Too Many")) return false;
      return failureCount < 2;
    },
  });
}

export function useBaeminReviewList(
  storeId: string | null,
  params?: { from?: string; to?: string; offset?: number; limit?: number }
) {
  const range = defaultDateRange();
  const from = params?.from ?? range.from;
  const to = params?.to ?? range.to;
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 10;
  return useQuery({
    queryKey: QUERY_KEY.store.baeminReviewList(storeId ?? "", {
      from,
      to,
      offset,
      limit,
    }),
    queryFn: () =>
      storeId != null
        ? getBaeminReviewList({ storeId, from, to, offset, limit })
        : Promise.reject(new Error("no store")),
    enabled: !!storeId,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      const msg = String((error as Error)?.message ?? "");
      if (msg.includes("429") || msg.includes("Too Many")) return false;
      return failureCount < 2;
    },
  });
}

/** count + list 한 번에. fetchAll=true 면 count.reviewCount 기준으로 전체 페이지 수집 */
export function useBaeminReviewSummary(
  storeId: string | null,
  params?: { from?: string; to?: string; offset?: number; limit?: number; fetchAll?: boolean }
) {
  const range = defaultDateRange();
  const from = params?.from ?? range.from;
  const to = params?.to ?? range.to;
  const offset = params?.offset ?? 0;
  const limit = params?.limit ?? 10;
  const fetchAll = params?.fetchAll ?? false;
  return useQuery({
    queryKey: QUERY_KEY.store.baeminReviewSummary(storeId ?? "", {
      from,
      to,
      offset,
      limit,
      fetchAll,
    }),
    queryFn: () =>
      storeId != null
        ? getBaeminReviewSummary({ storeId, from, to, offset, limit, fetchAll })
        : Promise.reject(new Error("no store")),
    enabled: !!storeId,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      const msg = String((error as Error)?.message ?? "");
      if (msg.includes("429") || msg.includes("Too Many")) return false;
      return failureCount < 2;
    },
  });
}

/**
 * 셀프 배민처럼 첫 10개 로드 후 무한 스크롤로 추가 요청.
 * pageParam = offset. 스크롤 시 fetchNextPage()로 offset 10, 20, ... 요청.
 */
export function useBaeminReviewSummaryInfinite(
  storeId: string | null,
  params?: { from?: string; to?: string; limit?: number }
) {
  const range = defaultDateRange();
  const from = params?.from ?? range.from;
  const to = params?.to ?? range.to;
  const limit = params?.limit ?? 10;

  return useInfiniteQuery({
    queryKey: QUERY_KEY.store.baeminReviewSummaryInfinite(storeId ?? "", { from, to, limit }),
    queryFn: async ({ pageParam }): Promise<BaeminReviewSummaryResult> => {
      if (storeId == null) throw new Error("no store");
      return getBaeminReviewSummary({
        storeId,
        from,
        to,
        offset: pageParam as number,
        limit,
      });
    },
    initialPageParam: 0 as number,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce(
        (sum, p) => sum + (p.list?.reviews?.length ?? 0),
        0
      );
      const total = lastPage.count?.reviewCount ?? 0;
      if (total > 0 && loaded < total) return loaded;
      if (lastPage.list?.next === true) return loaded;
      return undefined;
    },
    enabled: !!storeId,
    staleTime: 60 * 1000,
    retry: (failureCount, error) => {
      const msg = String((error as Error)?.message ?? "");
      if (msg.includes("429") || msg.includes("Too Many")) return false;
      return failureCount < 2;
    },
  });
}
