"use client";

import { useEffect, useRef, type MutableRefObject } from "react";
import type { ReviewData } from "@/entities/review/types";
import { getDisplayReplyContent, isReplyWriteExpired } from "@/entities/review/lib/review-utils";
import type { UseMutationResult } from "@tanstack/react-query";

type CreateDraftMutation = UseMutationResult<
  unknown,
  Error,
  { reviewId: string; draft_content?: string },
  unknown
>;

export function useReviewsManageAutoDraft(
  currentList: ReviewData[],
  createDraft: CreateDraftMutation,
  skipAutoCreateRef: MutableRefObject<Set<string>>,
) {
  const requestedDraftRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);

  const runNextDraftRef = useRef<() => void>(() => {});
  runNextDraftRef.current = () => {
    if (queueRef.current.length === 0) return;
    const reviewId = queueRef.current.shift()!;
    createDraft.mutate(
      { reviewId },
      { onSuccess: () => runNextDraftRef.current() },
    );
  };
  const processNextDraftRef = useRef<() => void>(() => {});
  processNextDraftRef.current = () => {
    if (createDraft.isPending || queueRef.current.length === 0) return;
    runNextDraftRef.current();
  };

  useEffect(() => {
    if (!currentList.length) return;
    for (const review of currentList) {
      const content = getDisplayReplyContent(review);
      if (content != null) continue;
      if (isReplyWriteExpired(review.written_at ?? null, review.platform))
        continue;
      if (requestedDraftRef.current.has(review.id)) continue;
      if (skipAutoCreateRef.current.has(review.id)) continue;
      requestedDraftRef.current.add(review.id);
      queueRef.current.push(review.id);
    }
    processNextDraftRef.current();
  }, [currentList, createDraft.isPending]);
}
