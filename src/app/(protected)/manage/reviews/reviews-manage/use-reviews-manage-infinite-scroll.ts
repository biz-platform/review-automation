"use client";

import { useCallback, useEffect, useRef } from "react";

export function useReviewsManageInfiniteScroll(
  isBaemin: boolean,
  hasNextBaemin: boolean,
  isFetchingNextBaemin: boolean,
  isLoadingBaemin: boolean,
  fetchNextBaemin: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  isLoading: boolean,
  fetchNextPage: () => void,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (isBaemin) {
      if (isLoadingBaemin || !hasNextBaemin || isFetchingNextBaemin) return;
      fetchNextBaemin();
    } else {
      if (isLoading || !hasNextPage || isFetchingNextPage) return;
      fetchNextPage();
    }
  }, [
    isBaemin,
    hasNextBaemin,
    isFetchingNextBaemin,
    isLoadingBaemin,
    fetchNextBaemin,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    fetchNextPage,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "100px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return { sentinelRef, loadMore };
}
