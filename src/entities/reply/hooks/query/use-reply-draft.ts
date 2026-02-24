"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getReplyDraft } from "@/entities/reply/api/reply-api";

export function useReplyDraft(reviewId: string | null) {
  return useQuery({
    queryKey: QUERY_KEY.reply.draft(reviewId ?? ""),
    queryFn: () => getReplyDraft({ reviewId: reviewId! }),
    enabled: !!reviewId,
  });
}
