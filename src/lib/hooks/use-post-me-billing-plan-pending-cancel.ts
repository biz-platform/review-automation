"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { postMeBillingPlanPendingCancel } from "@/lib/api/billing-api";

export function usePostMeBillingPlanPendingCancel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postMeBillingPlanPendingCancel,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.billing });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY.me.onboarding });
    },
  });
}
