"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getStore } from "@/entities/store/api/store-api";

export function useStore(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEY.store.detail(id ?? ""),
    queryFn: () => getStore({ id: id! }),
    enabled: !!id,
  });
}
