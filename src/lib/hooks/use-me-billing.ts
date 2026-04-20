"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getMeBillingOverview } from "@/lib/api/billing-api";

export function useMeBilling() {
  return useQuery({
    queryKey: QUERY_KEY.me.billing,
    queryFn: () => getMeBillingOverview(),
  });
}
