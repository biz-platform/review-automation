"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { postMeBillingPlanUpgrade } from "@/lib/api/billing-api";

export function usePostMeBillingPlanUpgrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMeBillingPlanUpgrade,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.billing });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.onboarding });
    },
  });
}
