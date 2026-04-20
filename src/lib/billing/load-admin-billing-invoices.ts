import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminBillingInvoiceListData,
  AdminBillingInvoicePaymentStatus,
  AdminBillingInvoiceRefundStatus,
  AdminBillingInvoiceRow,
  AdminCustomerFilterValue,
} from "@/entities/admin/types";
import { kstYmdBoundsUtc } from "@/lib/utils/kst-date";
import {
  effectiveRefundStatus,
  refundSubtextForAdminRow,
} from "@/lib/billing/admin-billing-row-map";

type InvoiceDb = {
  id: string;
  invoice_code: string;
  plan_name: string;
  paid_at: string;
  usage_period_start: string;
  usage_period_end: string;
  amount_won: number;
  payment_status: string;
  usage_status: string;
  refund_status: string;
  user_id: string;
};

type UserDb = {
  id: string;
  email: string | null;
  phone: string | null;
  role: string;
  referred_by_user_id: string | null;
};

function firstDayNextMonthYmd(y: number, m: number): string {
  if (m === 12) return `${y + 1}-01-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function intersectIds(
  a: string[] | null,
  b: string[] | null,
): string[] | null {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

async function fetchUserIdsForMemberType(
  supabase: SupabaseClient,
  memberType: AdminCustomerFilterValue,
  now: Date,
): Promise<string[] | null> {
  if (memberType === "all") return null;
  const nowIso = now.toISOString();

  if (memberType === "center_manager") {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("role", "center_manager");
    if (error) throw error;
    return (data ?? []).map((r) => (r as { id: string }).id);
  }
  if (memberType === "planner") {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("role", "planner");
    if (error) throw error;
    return (data ?? []).map((r) => (r as { id: string }).id);
  }
  if (memberType === "paid_member") {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("role", "member")
      .gt("paid_until", nowIso);
    if (error) throw error;
    return (data ?? []).map((r) => (r as { id: string }).id);
  }
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("role", "member")
    .or(`paid_until.is.null,paid_until.lt.${nowIso}`);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { id: string }).id);
}

async function fetchUserIdsForKeyword(
  supabase: SupabaseClient,
  keyword: string,
): Promise<string[] | null> {
  const k = keyword.trim();
  if (!k) return null;
  const pattern = `%${k}%`;
  const { data: byEmail, error: e1 } = await supabase
    .from("users")
    .select("id")
    .ilike("email", pattern);
  if (e1) throw e1;
  const { data: byPhone, error: e2 } = await supabase
    .from("users")
    .select("id")
    .ilike("phone", pattern);
  if (e2) throw e2;
  const ids = new Set<string>();
  for (const r of byEmail ?? []) ids.add(String((r as { id: string }).id));
  for (const r of byPhone ?? []) ids.add(String((r as { id: string }).id));
  return [...ids];
}

/** `.from().select()` 이후 체인 — SupabaseClient 제네릭 DB 타입 없이 체인만 공유 */
function applyInvoiceFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  q: any,
  params: {
    userIds: string[] | null;
    invoiceCode: string;
    month: string;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  let query = q;
  if (params.userIds != null) {
    query = query.in("user_id", params.userIds);
  }
  if (params.invoiceCode.trim()) {
    query = query.ilike(
      "invoice_code",
      `%${params.invoiceCode.trim()}%`,
    );
  }
  if (params.month.trim()) {
    const [ys, ms] = params.month.split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return query;
    }
    const startYmd = `${y}-${String(m).padStart(2, "0")}-01`;
    const nextFirst = firstDayNextMonthYmd(y, m);
    const gte = kstYmdBoundsUtc(startYmd, false).toISOString();
    const lt = kstYmdBoundsUtc(nextFirst, false).toISOString();
    query = query.gte("paid_at", gte).lt("paid_at", lt);
  }
  return query;
}

export async function loadAdminBillingInvoices(
  supabase: SupabaseClient,
  params: {
    limit: number;
    offset: number;
    memberType: AdminCustomerFilterValue;
    keyword: string;
    invoiceCode: string;
    month: string;
  },
): Promise<AdminBillingInvoiceListData> {
  const now = new Date();
  const userIdsMt = await fetchUserIdsForMemberType(
    supabase,
    params.memberType,
    now,
  );
  const userIdsKw = await fetchUserIdsForKeyword(supabase, params.keyword);
  const userIds = intersectIds(userIdsMt, userIdsKw);

  if (userIds !== null && userIds.length === 0) {
    return { list: [], count: 0 };
  }

  const baseSelect = () =>
    supabase
      .from("member_billing_invoices")
      .select("id", { count: "exact", head: true });

  const countQuery = applyInvoiceFilters(baseSelect(), {
    userIds,
    invoiceCode: params.invoiceCode,
    month: params.month,
  });
  const { count, error: countErr } = await countQuery;
  if (countErr) throw countErr;

  const dataQuery = applyInvoiceFilters(
    supabase.from("member_billing_invoices").select("*"),
    {
      userIds,
      invoiceCode: params.invoiceCode,
      month: params.month,
    },
  );
  const { data: invRows, error: invErr } = await dataQuery
    .order("paid_at", { ascending: false })
    .range(params.offset, params.offset + params.limit - 1);
  if (invErr) throw invErr;

  const invoices = (invRows ?? []) as InvoiceDb[];
  if (invoices.length === 0) {
    return { list: [], count: count ?? 0 };
  }

  const payerIds = [...new Set(invoices.map((i) => i.user_id))];
  const { data: payers, error: payerErr } = await supabase
    .from("users")
    .select("id, email, phone, role, referred_by_user_id")
    .in("id", payerIds);
  if (payerErr) throw payerErr;
  const payerMap = new Map(
    (payers ?? []).map((p) => [String((p as UserDb).id), p as UserDb]),
  );

  const refIds = [
    ...new Set(
      (payers ?? [])
        .map((p) => (p as UserDb).referred_by_user_id)
        .filter((x): x is string => x != null && x !== ""),
    ),
  ];
  let refCodeMap = new Map<string, string | null>();
  if (refIds.length > 0) {
    const { data: refs, error: refErr } = await supabase
      .from("users")
      .select("id, referral_code")
      .in("id", refIds);
    if (refErr) throw refErr;
    refCodeMap = new Map(
      (refs ?? []).map((r) => {
        const row = r as { id: string; referral_code: string | null };
        return [row.id, row.referral_code];
      }),
    );
  }

  const list: AdminBillingInvoiceRow[] = invoices.map((inv) => {
    const payer = payerMap.get(inv.user_id);
    const role = payer?.role;
    const payerRole =
      role === "center_manager" || role === "planner" || role === "member"
        ? role
        : "member";
    const refId = payer?.referred_by_user_id ?? null;
    const referrerCode =
      refId != null ? (refCodeMap.get(refId) ?? null) : null;
    const ps =
      inv.payment_status === "error"
        ? "error"
        : ("completed" as AdminBillingInvoicePaymentStatus);
    const rs = (inv.refund_status ?? "none") as AdminBillingInvoiceRefundStatus;
    const paidAt = new Date(inv.paid_at);
    const eff = effectiveRefundStatus(ps, rs, paidAt, now);
    const sub = refundSubtextForAdminRow(ps, eff, rs, paidAt, now);

    return {
      id: inv.id,
      invoiceCode: inv.invoice_code,
      paidAt: inv.paid_at,
      payerEmail: payer?.email ?? null,
      payerPhone: payer?.phone ?? null,
      payerRole,
      planName: inv.plan_name,
      amountWon: inv.amount_won,
      usagePeriodStart: inv.usage_period_start,
      usagePeriodEnd: inv.usage_period_end,
      referrerCode: referrerCode ?? null,
      paymentStatus: ps,
      refundStatus: eff,
      refundSubtext: sub,
    };
  });

  return { list, count: count ?? 0 };
}
