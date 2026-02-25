"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { syncYogiyoReviews } from "@/entities/store/api/store-api";

export type SyncYogiyoReviewsVariables = {
  storeId: string;
  signal?: AbortSignal;
};

export function useSyncYogiyoReviews() {
  const queryClient = useQueryClient();
  return useMutation<
    { upserted: number },
    Error,
    SyncYogiyoReviewsVariables
  >({
    mutationFn: (params) => syncYogiyoReviews(params),
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
