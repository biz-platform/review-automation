"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { registerReply } from "@/entities/reply/api/reply-api";
import { pollBrowserJob } from "@/lib/poll-browser-job";

export type RegisterReplyVariables = {
  reviewId: string;
  storeId: string;
  content: string;
  signal?: AbortSignal;
};

export function useRegisterReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      storeId,
      content,
      signal,
    }: RegisterReplyVariables) => {
      const { jobId } = await registerReply({ reviewId, content });
      const job = await pollBrowserJob(storeId, jobId, { signal });
      if (job.status === "failed") {
        throw new Error(job.error_message ?? "플랫폼 댓글 등록 실패");
      }
      if (job.status === "cancelled") {
        throw new DOMException("취소됨", "AbortError");
      }
      return { reviewId, jobId, content };
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
                r.id === data.reviewId ? { ...r, platform_reply_content: data.content } : r,
              ),
            })),
          };
        },
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.reply.draft(data.reviewId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.reviewId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
