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

/** GET /api/me/billing — 유료 구독 vs 인보이스 정합성 */
export type MeBillingLedgerHealthData = {
  /** member/planner: paid_until ≥ now */
  paidSubscriptionActive: boolean;
  /** completed + active 인보이스 존재 */
  hasActiveCompletedInvoice: boolean;
  /** 유료로 보이는데 활성 인보이스 없음 */
  missingActiveInvoice: boolean;
};

export type MeBillingOverviewData = {
  cardMask: string | null;
  invoices: MeBillingInvoiceData[];
  pendingPlanKey: "pro" | "premium" | null;
  pendingPlanEffectiveAt: string | null;
  ledgerHealth: MeBillingLedgerHealthData;
};

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      error?: string;
      detail?: string;
      message?: string;
      title?: string;
    };
    const msg = err.detail ?? err.message ?? err.title ?? err.error ?? res.statusText;
    const out = res.status === 429 ? `429 ${msg}` : msg;
    throw new Error(out);
  }
  const data = await res.json();
  return data.result as T;
}

export const getMeBillingOverview: AsyncApiRequestFn<
  MeBillingOverviewData,
  void
> = async () => {
  return getJson<MeBillingOverviewData>(API_ENDPOINT.meBilling);
};

export type MeBillingPlanUpgradeApiRequestData = {
  clientExpectedChargeWon: number;
};

export type MeBillingPlanUpgradeData = {
  success: true;
  upgraded: true;
  chargeWon: number;
  activeInvoiceId: string;
  deltaInvoiceId?: string;
};

export const postMeBillingPlanUpgrade: AsyncApiRequestFn<
  MeBillingPlanUpgradeData,
  MeBillingPlanUpgradeApiRequestData
> = async (body) => {
  return getJson<MeBillingPlanUpgradeData>(API_ENDPOINT.meBillingPlanUpgrade, {
    method: "POST",
    body: JSON.stringify(body),
  });
};

export type MeBillingPlanDowngradeData = {
  success: true;
  scheduled: true;
  pendingPlanKey: "pro";
  effectiveAt: string;
};

export const postMeBillingPlanDowngrade: AsyncApiRequestFn<
  MeBillingPlanDowngradeData,
  void
> = async () => {
  return getJson<MeBillingPlanDowngradeData>(API_ENDPOINT.meBillingPlanDowngrade, {
    method: "POST",
    body: JSON.stringify({}),
  });
};

export type MeBillingPlanPendingCancelData = { success: true; cleared: boolean };

export const postMeBillingPlanPendingCancel: AsyncApiRequestFn<
  MeBillingPlanPendingCancelData,
  void
> = async () => {
  return getJson<MeBillingPlanPendingCancelData>(
    API_ENDPOINT.meBillingPlanPendingCancel,
    {
      method: "POST",
      body: JSON.stringify({}),
    },
  );
};
