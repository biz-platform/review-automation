"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { syncCoupangEatsReviews } from "@/entities/store/api/store-api";

export type SyncCoupangEatsReviewsVariables = {
  storeId: string;
  signal?: AbortSignal;
};

export function useSyncCoupangEatsReviews() {
  const queryClient = useQueryClient();
  return useMutation<
    { upserted: number },
    Error,
    SyncCoupangEatsReviewsVariables
  >({
    mutationFn: (params) => syncCoupangEatsReviews(params),
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
