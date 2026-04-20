"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { postMeSubscriptionResumeAtPeriodEnd } from "@/lib/api/me-api";

export function usePostMeSubscriptionResumeAtPeriodEnd() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMeSubscriptionResumeAtPeriodEnd,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.onboarding });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.billing });
    },
  });
}
