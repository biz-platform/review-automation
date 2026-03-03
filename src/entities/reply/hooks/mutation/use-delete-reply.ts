"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { deleteReply } from "@/entities/reply/api/reply-api";
import { pollBrowserJob } from "@/lib/poll-browser-job";

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
      queryClient.setQueriesData(
        { queryKey: QUERY_KEY.review.root },
        (old: { pages?: { result?: { id: string; platform_reply_content?: string | null }[] }[] } | undefined) => {
          if (!old?.pages?.length) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              result: page.result?.map((r) =>
                r.id === data.reviewId ? { ...r, platform_reply_content: null } : r,
              ),
            })),
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.reviewId) });
    },
  });
}
