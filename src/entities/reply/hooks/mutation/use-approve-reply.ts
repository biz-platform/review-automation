"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { approveReply } from "@/entities/reply/api/reply-api";
import type { ApproveReplyApiRequestData } from "@/entities/reply/types";

export function useApproveReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { reviewId: string } & ApproveReplyApiRequestData) => approveReply(params),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.reply.draft(data.review_id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(data.review_id) });
    },
  });
}
