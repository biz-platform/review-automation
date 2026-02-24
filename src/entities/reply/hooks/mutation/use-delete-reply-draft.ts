"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { deleteReplyDraft } from "@/entities/reply/api/reply-api";

export function useDeleteReplyDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { reviewId: string }) => deleteReplyDraft(params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.reply.draft(variables.reviewId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(variables.reviewId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
