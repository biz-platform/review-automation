"use client";

import { useEffect, useRef } from "react";
import {
  REVIEW_MANAGE_AUTO_PREFETCH_LTE3_MAX_ATTEMPTS,
  REVIEW_MANAGE_AUTO_PREFETCH_MAX_ATTEMPTS,
  REVIEW_MANAGE_AUTO_PREFETCH_MIN_ITEMS,
  type StarRatingFilterValue,
} from "@/app/(protected)/manage/reviews/constants";

export type UseReviewsManageAutoPrefetchParams = {
  enabled: boolean;
  isBaemin: boolean;
  /** 기간·별점·매장 등 클라이언트 필터 적용 후 개수 */
  filteredListLength: number;
  hasNextPage: boolean;
  hasNextBaemin: boolean;
  isLoading: boolean;
  baeminListLoading: boolean;
  isFetchingNextPage: boolean;
  isFetchingNextBaemin: boolean;
  fetchNextPage: () => void;
  fetchNextBaemin: () => void;
  /** 바뀌면 자동 선로딩 시도 횟수 리셋 */
  resetKey: string;
  starFilter: StarRatingFilterValue;
};

/**
 * 화면 하단(센티널)에 닿기 전에도, 필터 후 목록이 충분히 쌓이도록 다음 페이지를 최대 N회까지 요청.
 */
export function useReviewsManageAutoPrefetch(
  p: UseReviewsManageAutoPrefetchParams,
): void {
  const attemptsRef = useRef(0);
  const resetKeyRef = useRef(p.resetKey);

  useEffect(() => {
    if (p.resetKey !== resetKeyRef.current) {
      resetKeyRef.current = p.resetKey;
      attemptsRef.current = 0;
    }

    if (!p.enabled) return;

    const lte3Prefetch = p.starFilter === "lte3";
    const maxAttempts = lte3Prefetch
      ? REVIEW_MANAGE_AUTO_PREFETCH_LTE3_MAX_ATTEMPTS
      : REVIEW_MANAGE_AUTO_PREFETCH_MAX_ATTEMPTS;
    const minSatisfied =
      !lte3Prefetch &&
      p.filteredListLength >= REVIEW_MANAGE_AUTO_PREFETCH_MIN_ITEMS;

    if (p.isBaemin) {
      if (
        p.baeminListLoading ||
        p.isFetchingNextBaemin ||
        !p.hasNextBaemin
      ) {
        return;
      }
      if (minSatisfied) {
        return;
      }
      if (attemptsRef.current >= maxAttempts) {
        return;
      }
      attemptsRef.current += 1;
      p.fetchNextBaemin();
      return;
    }

    if (p.isLoading || p.isFetchingNextPage || !p.hasNextPage) {
      return;
    }
    if (minSatisfied) {
      return;
    }
    if (attemptsRef.current >= maxAttempts) {
      return;
    }
    attemptsRef.current += 1;
    p.fetchNextPage();
  }, [
    p.enabled,
    p.isBaemin,
    p.filteredListLength,
    p.hasNextPage,
    p.hasNextBaemin,
    p.isLoading,
    p.baeminListLoading,
    p.isFetchingNextPage,
    p.isFetchingNextBaemin,
    p.fetchNextPage,
    p.fetchNextBaemin,
    p.resetKey,
    p.starFilter,
  ]);
}
