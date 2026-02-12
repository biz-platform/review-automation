"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { createReplyDraft } from "@/entities/reply/api/reply-api";

export function useCreateReplyDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { reviewId: string }) => createReplyDraft(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.reply.draft(data.review_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.review_id) });
    },
  });
}
