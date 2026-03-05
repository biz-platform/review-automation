import type { QueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";

type ReviewRow = { id: string; platform_reply_content?: string | null; [key: string]: unknown };
type InfinitePage = { result?: ReviewRow[]; [key: string]: unknown };
type InfiniteData = { pages?: InfinitePage[]; pageParams?: unknown[] };

/**
 * review root 하위의 모든 리뷰 목록 쿼리 캐시에서 해당 reviewId만 갱신.
 * getQueriesData로 현재 캐시를 읽어서 반영하므로, a/b/c 순차 완료 시 서로 덮어쓰지 않음.
 */
export function updateReviewInListCache(
  queryClient: QueryClient,
  reviewId: string,
  patch: { platform_reply_content?: string | null },
): void {
  const pairs = queryClient.getQueriesData<InfiniteData>({
    queryKey: QUERY_KEY.review.root,
  });
  for (const [queryKey, old] of pairs) {
    if (!old?.pages?.length) continue;
    const updated: InfiniteData = {
      ...old,
      pages: old.pages.map((page) => ({
        ...page,
        result: page.result?.map((r) =>
          r.id === reviewId ? { ...r, ...patch } : r,
        ),
      })),
    };
    queryClient.setQueryData(queryKey, updated);
  }
}
