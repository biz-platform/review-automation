import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  AdminBillingInvoiceListApiRequestData,
  AdminBillingInvoiceListData,
  AdminBillingPendingStaleListApiRequestData,
  AdminBillingPendingStaleListData,
  PatchAdminBillingInvoiceRefundApiRequestData,
} from "@/entities/admin/types";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; title?: string };
    throw new Error(err.detail ?? err.title ?? res.statusText);
  }
  const data = await res.json();
  return data.result as T;
}

export const getAdminBillingInvoices: AsyncApiRequestFn<
  AdminBillingInvoiceListData,
  AdminBillingInvoiceListApiRequestData
> = async (params) => {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  if (params?.offset != null) q.set("offset", String(params.offset));
  if (params?.memberType && params.memberType !== "all") {
    q.set("memberType", params.memberType);
  }
  if (params?.keyword?.trim()) q.set("keyword", params.keyword.trim());
  if (params?.invoiceCode?.trim()) {
    q.set("invoiceCode", params.invoiceCode.trim());
  }
  if (params?.month?.trim()) q.set("month", params.month.trim());
  const qs = q.toString();
  const url = qs
    ? `${API_ENDPOINT.admin.billingInvoices}?${qs}`
    : API_ENDPOINT.admin.billingInvoices;
  return getJson<AdminBillingInvoiceListData>(url);
};

export const getAdminBillingPendingStale: AsyncApiRequestFn<
  AdminBillingPendingStaleListData,
  AdminBillingPendingStaleListApiRequestData
> = async (params) => {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set("limit", String(params.limit));
  const qs = q.toString();
  const url = qs
    ? `${API_ENDPOINT.admin.billingPendingStale}?${qs}`
    : API_ENDPOINT.admin.billingPendingStale;
  return getJson<AdminBillingPendingStaleListData>(url);
};

export const patchAdminBillingInvoiceRefund: AsyncApiRequestFn<
  { success: true },
  { invoiceId: string; body: PatchAdminBillingInvoiceRefundApiRequestData }
> = async ({ invoiceId, body }) => {
  const res = await fetch(API_ENDPOINT.admin.billingInvoiceRefund(invoiceId), {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { detail?: string; title?: string };
    throw new Error(err.detail ?? err.title ?? res.statusText);
  }
  const data = await res.json();
  return data.result as { success: true };
};
