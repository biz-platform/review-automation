import { NextRequest, NextResponse } from "next/server";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type {
  MeBillingInvoiceData,
  MeBillingOverviewData,
} from "@/lib/api/billing-api";
import {
  formatPaymentCardMask,
} from "@/lib/billing/format-billing-display";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

type UserCardRow = {
  payment_card_bin4?: string | null;
  payment_card_last4?: string | null;
};

type InvoiceRow = {
  id: string;
  invoice_code: string;
  plan_name: string;
  paid_at: string;
  usage_period_start: string;
  usage_period_end: string;
  amount_won: number;
  payment_status: string;
  usage_status: string;
};

function isPgUndefinedColumn(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42703"
  );
}

function isPgUndefinedTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

function mapInvoiceRow(row: InvoiceRow): MeBillingInvoiceData | null {
  const ps = row.payment_status;
  const us = row.usage_status;
  if (ps !== "completed" && ps !== "error") return null;
  if (us !== "active" && us !== "suspended" && us !== "expired") return null;
  return {
    id: row.id,
    invoiceCode: row.invoice_code,
    planName: row.plan_name,
    paidAt: row.paid_at,
    usagePeriodStart: row.usage_period_start,
    usagePeriodEnd: row.usage_period_end,
    amountWon: row.amount_won,
    paymentStatus: ps,
    usageStatus: us,
  };
}

async function getHandler(_request: NextRequest) {
  const { user, supabase } = await getUser(_request);

  let cardMask: string | null = null;
  const fullUserSelect = await supabase
    .from("users")
    .select("payment_card_bin4, payment_card_last4")
    .eq("id", user.id)
    .maybeSingle();

  if (fullUserSelect.error && isPgUndefinedColumn(fullUserSelect.error)) {
    cardMask = null;
  } else if (fullUserSelect.error) {
    throw fullUserSelect.error;
  } else {
    const row = fullUserSelect.data as UserCardRow | null;
    cardMask = formatPaymentCardMask(
      row?.payment_card_bin4,
      row?.payment_card_last4,
    );
  }

  let invoices: MeBillingInvoiceData[] = [];
  const invSelect = await supabase
    .from("member_billing_invoices")
    .select(
      "id, invoice_code, plan_name, paid_at, usage_period_start, usage_period_end, amount_won, payment_status, usage_status",
    )
    .eq("user_id", user.id)
    .order("paid_at", { ascending: false });

  if (invSelect.error && isPgUndefinedTable(invSelect.error)) {
    invoices = [];
  } else if (invSelect.error) {
    throw invSelect.error;
  } else {
    invoices = (invSelect.data ?? [])
      .map((r) => mapInvoiceRow(r as InvoiceRow))
      .filter((x): x is MeBillingInvoiceData => x != null);
  }

  const result: MeBillingOverviewData = { cardMask, invoices };
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result,
  });
}

export const GET = withRouteHandler(getHandler);
