"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { updateToneSettings } from "@/entities/store/api/store-api";
import type { ToneSettingsApiRequestData } from "@/entities/store/types";

export function useUpdateToneSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { storeId: string } & ToneSettingsApiRequestData) =>
      updateToneSettings(params),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEY.store.toneSettings(variables.storeId),
      });
    },
  });
}
