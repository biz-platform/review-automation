"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { collectStoreReviews } from "@/entities/store/api/store-collect-api";

export function useCollectStoreReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { storeId: string }) => collectStoreReviews(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.list({ store_id: variables.storeId }) });
    },
  });
}
