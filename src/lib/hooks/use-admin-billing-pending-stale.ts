"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getAdminBillingPendingStale } from "@/entities/admin/api/admin-billing-api";
import type { AdminBillingPendingStaleListApiRequestData } from "@/entities/admin/types";

export function useAdminBillingPendingStale(
  params: AdminBillingPendingStaleListApiRequestData = {},
) {
  const key = { limit: params.limit ?? 200 };
  return useQuery({
    queryKey: QUERY_KEY.admin.billingPendingStale(key),
    queryFn: () => getAdminBillingPendingStale(key),
  });
}
