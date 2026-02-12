"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getToneSettings } from "@/entities/store/api/store-api";

export function useToneSettings(storeId: string | null) {
  return useQuery({
    queryKey: QUERY_KEY.store.toneSettings(storeId ?? ""),
    queryFn: () => getToneSettings({ storeId: storeId! }),
    enabled: !!storeId,
  });
}
