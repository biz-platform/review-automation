"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { createStore } from "@/entities/store/api/store-api";
import type { CreateStoreApiRequestData } from "@/entities/store/types";

export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStoreApiRequestData) => createStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
    },
  });
}
