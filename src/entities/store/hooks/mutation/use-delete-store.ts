"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { deleteStore } from "@/entities/store/api/store-api";

export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string }) => deleteStore(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
    },
  });
}
