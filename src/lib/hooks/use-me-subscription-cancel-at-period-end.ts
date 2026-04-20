"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { postMeSubscriptionCancelAtPeriodEnd } from "@/lib/api/me-api";

export function usePostMeSubscriptionCancelAtPeriodEnd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMeSubscriptionCancelAtPeriodEnd,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.onboarding });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.billing });
    },
  });
}
