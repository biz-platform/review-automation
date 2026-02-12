"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { collectReviews } from "@/entities/review/api/review-api";

export function useCollectReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { reviewId: string }) => collectReviews(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.detail(variables.reviewId) });
    },
  });
}
