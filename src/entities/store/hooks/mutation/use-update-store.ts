"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { updateStore } from "@/entities/store/api/store-api";
import type { UpdateStoreApiRequestData } from "@/entities/store/types";

export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string } & UpdateStoreApiRequestData) => updateStore(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.detail(variables.id) });
    },
  });
}
