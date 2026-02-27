"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { createReplyDraft } from "@/entities/reply/api/reply-api";
import type { ReplyDraftData } from "@/entities/reply/types";

export type CreateReplyDraftVariables = {
  reviewId: string;
  draft_content?: string;
};

export function useCreateReplyDraft() {
  const queryClient = useQueryClient();
  return useMutation<
    ReplyDraftData,
    Error,
    CreateReplyDraftVariables
  >({
    mutationFn: (params) => createReplyDraft(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.reply.draft(data.review_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.review_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
