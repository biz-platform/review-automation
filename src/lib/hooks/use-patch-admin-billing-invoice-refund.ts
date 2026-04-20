"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { patchAdminBillingInvoiceRefund } from "@/entities/admin/api/admin-billing-api";
import type { PatchAdminBillingInvoiceRefundApiRequestData } from "@/entities/admin/types";

export function usePatchAdminBillingInvoiceRefund() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: {
      invoiceId: string;
      body: PatchAdminBillingInvoiceRefundApiRequestData;
    }) => patchAdminBillingInvoiceRefund(args),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey[0] === "admin" &&
          q.queryKey[1] === "billing-invoices",
      });
    },
  });
}
