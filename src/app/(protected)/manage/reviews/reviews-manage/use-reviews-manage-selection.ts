"use client";

import { useState, useCallback } from "react";
import type { ReviewData } from "@/entities/review/types";
import {
  getDisplayReplyContent,
  isReplyWriteExpired,
} from "@/entities/review/lib/review-utils";

export function useReviewsManageSelection(filteredList: ReviewData[]) {
  const [selectedReviewIds, setSelectedReviewIds] = useState<Set<string>>(new Set());

  const isReviewUnanswered = useCallback(
    (review: ReviewData) =>
      !review.platform_reply_content &&
      !isReplyWriteExpired(review.written_at ?? null, review.platform),
    [],
  );

  const isReviewRegisterable = useCallback(
    (review: ReviewData) => {
      if (!isReviewUnanswered(review)) return false;
      const draftContent = getDisplayReplyContent(review);
      return !!draftContent?.trim();
    },
    [isReviewUnanswered],
  );

  const toggleReviewSelection = useCallback((reviewId: string) => {
    setSelectedReviewIds((prev) => {
      const next = new Set(prev);
      if (next.has(reviewId)) next.delete(reviewId);
      else next.add(reviewId);
      return next;
    });
  }, []);

  const selectAllUnanswered = useCallback(() => {
    const unansweredIds = filteredList
      .filter((r) => isReviewRegisterable(r))
      .map((r) => r.id);
    setSelectedReviewIds((prev) => {
      const allSelected =
        unansweredIds.length > 0 && unansweredIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        unansweredIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...unansweredIds]);
    });
  }, [filteredList, isReviewRegisterable]);

  const clearSelection = useCallback(() => setSelectedReviewIds(new Set()), []);

  return {
    selectedReviewIds,
    toggleReviewSelection,
    selectAllUnanswered,
    isReviewUnanswered,
    isReviewRegisterable,
    clearSelection,
  };
}
