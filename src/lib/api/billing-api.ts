import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

export type MeBillingInvoiceData = {
  id: string;
  invoiceCode: string;
  planName: string;
  paidAt: string;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  amountWon: number;
  paymentStatus: "completed" | "error";
  usageStatus: "active" | "suspended" | "expired";
};

export type MeBillingOverviewData = {
  cardMask: string | null;
  invoices: MeBillingInvoiceData[];
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  return data.result as T;
}

export const getMeBillingOverview: AsyncApiRequestFn<
  MeBillingOverviewData,
  void
> = async () => {
  return getJson<MeBillingOverviewData>(API_ENDPOINT.meBilling);
};
