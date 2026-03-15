"use client";

import { useCallback, useEffect, useRef } from "react";

export function useReviewsManageInfiniteScroll(
  isBaemin: boolean,
  hasNextBaemin: boolean,
  isFetchingNextBaemin: boolean,
  fetchNextBaemin: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean,
  fetchNextPage: () => void,
) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    if (isBaemin) {
      if (hasNextBaemin && !isFetchingNextBaemin) fetchNextBaemin();
    } else {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }
  }, [
    isBaemin,
    hasNextBaemin,
    isFetchingNextBaemin,
    fetchNextBaemin,
    hasNextPage,
    isFetchingNextPage,
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
