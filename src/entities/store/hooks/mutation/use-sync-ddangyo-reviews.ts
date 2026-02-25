"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { syncDdangyoReviews } from "@/entities/store/api/store-api";

export type SyncDdangyoReviewsVariables = {
  storeId: string;
  signal?: AbortSignal;
};

export function useSyncDdangyoReviews() {
  const queryClient = useQueryClient();
  return useMutation<
    { upserted: number },
    Error,
    SyncDdangyoReviewsVariables
  >({
    mutationFn: (params) => syncDdangyoReviews(params),
    onSuccess: (_, _variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
