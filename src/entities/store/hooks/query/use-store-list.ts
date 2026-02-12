"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getStoreList } from "@/entities/store/api/store-api";

export function useStoreList(linkedPlatform?: string) {
  return useQuery({
    queryKey: linkedPlatform
      ? QUERY_KEY.store.listLinked(linkedPlatform)
      : QUERY_KEY.store.list,
    queryFn: () => getStoreList(linkedPlatform ? { linkedPlatform } : undefined),
  });
}
