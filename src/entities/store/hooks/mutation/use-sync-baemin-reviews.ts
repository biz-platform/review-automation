"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { syncBaeminReviews } from "@/entities/store/api/store-api";

export function useSyncBaeminReviews() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { storeId: string }) => syncBaeminReviews(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    },
  });
}
