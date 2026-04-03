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
  const observerRef = useRef<IntersectionObserver | null>(null);
  const armedRef = useRef(true);

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
    observerRef.current?.disconnect();
    armedRef.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries[0]?.isIntersecting;
        if (!hit) return;
        if (!armedRef.current) return;

        // 1) 폭주 방지: 한 번 트리거되면 unobserve → fetch 완료 후 재-관찰
        armedRef.current = false;
        observer.unobserve(el);
        loadMore();
      },
      { rootMargin: "100px", threshold: 0 },
    );
    observerRef.current = observer;
    observer.observe(el);

    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    const el = sentinelRef.current;
    const observer = observerRef.current;
    if (!el || !observer) return;

    const fetching = isBaemin ? isFetchingNextBaemin : isFetchingNextPage;
    const hasNext = isBaemin ? hasNextBaemin : hasNextPage;
    const loading = isBaemin ? isLoadingBaemin : isLoading;

    if (!fetching && !loading && hasNext) {
      // fetch가 끝났을 때만 다시 observe
      armedRef.current = true;
      observer.observe(el);
    }
  }, [
    isBaemin,
    hasNextBaemin,
    isFetchingNextBaemin,
    isLoadingBaemin,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  ]);

  return { sentinelRef, loadMore };
}
