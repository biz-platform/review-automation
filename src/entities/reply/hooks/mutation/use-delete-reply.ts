"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { deleteReply } from "@/entities/reply/api/reply-api";
import { pollBrowserJob } from "@/lib/poll-browser-job";
import { updateReviewInListCache } from "@/entities/review/lib/update-review-in-list-cache";
import { replyPendingCallbacksRef } from "@/entities/reply/lib/reply-pending-callbacks";

export type DeleteReplyVariables = {
  reviewId: string;
  storeId: string;
  signal?: AbortSignal;
};

export function useDeleteReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      storeId,
      signal,
    }: DeleteReplyVariables) => {
      const { jobId } = await deleteReply({ reviewId });
      const job = await pollBrowserJob(storeId, jobId, { signal });
      if (job.status === "failed") {
        throw new Error(job.error_message ?? "플랫폼 댓글 삭제 실패");
      }
      if (job.status === "cancelled") {
        throw new DOMException("취소됨", "AbortError");
      }
      return { reviewId, jobId };
    },
    onSuccess: (data) => {
      updateReviewInListCache(queryClient, data.reviewId, {
        platform_reply_content: null,
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.reviewId) });
    },
    onSettled: (_data, _error, variables) => {
      if (variables?.reviewId) {
        replyPendingCallbacksRef.current?.removePendingDelete?.(variables.reviewId);
      }
    },
  });
}
