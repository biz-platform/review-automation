"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getAdminBillingInvoices } from "@/entities/admin/api/admin-billing-api";
import type { AdminBillingInvoiceListApiRequestData } from "@/entities/admin/types";

export function useAdminBillingInvoices(
  params: AdminBillingInvoiceListApiRequestData,
) {
  const key = {
    limit: params.limit ?? 20,
    offset: params.offset ?? 0,
    memberType: params.memberType ?? "all",
    keyword: params.keyword ?? "",
    invoiceCode: params.invoiceCode ?? "",
    month: params.month ?? "",
  };
  return useQuery({
    queryKey: QUERY_KEY.admin.billingInvoices(key),
    queryFn: () => getAdminBillingInvoices(key),
  });
}
