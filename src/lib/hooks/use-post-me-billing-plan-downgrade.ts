"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { postMeBillingPlanDowngrade } from "@/lib/api/billing-api";

export function usePostMeBillingPlanDowngrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMeBillingPlanDowngrade,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.billing });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.onboarding });
    },
  });
}
