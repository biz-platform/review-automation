import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { AppBadRequestError, AppConflictError } from "@/lib/errors/app-error";
import { computeProToPremiumUpgradeChargeWonFromInvoice } from "@/lib/billing/member-plan-proration";

type UserRow = {
  is_admin?: boolean | null;
  role?: string | null;
  paid_at?: string | null;
  paid_until?: string | null;
  billing_pending_plan_key?: string | null;
  billing_pending_plan_effective_at?: string | null;
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

function paidActive(paidUntilIso: string | null | undefined, now: Date): boolean {
  if (paidUntilIso == null || String(paidUntilIso).trim() === "") return false;
  const paidUntil = new Date(String(paidUntilIso));
  return paidUntil.getTime() >= now.getTime();
}

function assertPaidMember(user: UserRow, now: Date): void {
  if (user.is_admin === true) {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이 계정은 요금제 변경 대상이 아닙니다.",
    });
  }
  const role = String(user.role ?? "");
  if (role === "center_manager") {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이용 중인 요금제가 없습니다.",
    });
  }
  if (role !== "member" && role !== "planner") {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이용 중인 요금제가 없습니다.",
    });
  }
  if (!paidActive(user.paid_until ?? null, now)) {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_NOT_ACTIVE",
      message: "유료 구독이 활성 상태가 아닙니다.",
      detail: "만료된 구독에서는 요금제 변경을 진행할 수 없습니다.",
    });
  }
}

function planKeyFromInvoicePlanName(planName: string): "pro" | "premium" | null {
  if (planName.includes("프로")) return "pro";
  if (planName.includes("프리미엄")) return "premium";
  return null;
}

async function fetchLatestActiveInvoice(
  userId: string,
): Promise<InvoiceRow | null> {
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("member_billing_invoices")
    .select(
      "id, invoice_code, plan_name, paid_at, usage_period_start, usage_period_end, amount_won, payment_status, usage_status",
    )
    .eq("user_id", userId)
    .eq("payment_status", "completed")
    .eq("usage_status", "active")
    .order("paid_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data?.[0] ?? null) as InvoiceRow | null;
  return row;
}

function newInvoiceCode(prefix: string): string {
  const raw = crypto.randomUUID().replaceAll("-", "");
  const suffix = raw.slice(0, 22);
  const code = `${prefix}${suffix}`;
  return code.slice(0, 30);
}

export type MemberPlanUpgradeResult = {
  success: true;
  upgraded: true;
  chargeWon: number;
  activeInvoiceId: string;
  deltaInvoiceId?: string;
};

export async function applyMemberProToPremiumUpgrade(params: {
  userId: string;
  clientExpectedChargeWon: number;
  now?: Date;
}): Promise<MemberPlanUpgradeResult> {
  const now = params.now ?? new Date();
  const admin = createServiceRoleClient();

  const { data: userRow, error: userErr } = await admin
    .from("users")
    .select(
      "is_admin, role, paid_at, paid_until, billing_pending_plan_key, billing_pending_plan_effective_at",
    )
    .eq("id", params.userId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow) {
    throw new AppBadRequestError({
      code: "PROFILE_NOT_FOUND",
      message: "사용자 정보를 찾을 수 없습니다.",
    });
  }

  assertPaidMember(userRow as UserRow, now);

  const pendingKey = (userRow as UserRow).billing_pending_plan_key ?? null;
  if (pendingKey != null && String(pendingKey).trim() !== "") {
    throw new AppConflictError({
      code: "BILLING_PLAN_CHANGE_PENDING",
      message: "이미 요금제 변경 예약이 있습니다.",
      detail: "예약을 먼저 취소한 뒤 업그레이드를 진행해 주세요.",
    });
  }

  const inv = await fetchLatestActiveInvoice(params.userId);
  if (!inv) {
    throw new AppBadRequestError({
      code: "BILLING_ACTIVE_INVOICE_NOT_FOUND",
      message: "활성 구독 청구 정보를 찾을 수 없습니다.",
    });
  }

  const current = planKeyFromInvoicePlanName(inv.plan_name);
  if (current !== "pro") {
    throw new AppBadRequestError({
      code: "BILLING_PLAN_UPGRADE_NOT_APPLICABLE",
      message: "프로 요금제에서만 업그레이드할 수 있습니다.",
    });
  }

  const calc = computeProToPremiumUpgradeChargeWonFromInvoice(
    {
      usagePeriodStart: inv.usage_period_start,
      usagePeriodEnd: inv.usage_period_end,
    },
    now,
  );

  const expected = calc.chargeWonRoundedTo100;
  if (Math.abs(expected - params.clientExpectedChargeWon) > 1) {
    throw new AppBadRequestError({
      code: "BILLING_UPGRADE_AMOUNT_MISMATCH",
      message: "업그레이드 결제 금액이 최신 계산과 일치하지 않습니다.",
      detail: `expected=${expected}, client=${params.clientExpectedChargeWon}`,
    });
  }

  if (expected <= 0) {
    throw new AppBadRequestError({
      code: "BILLING_UPGRADE_AMOUNT_INVALID",
      message: "업그레이드 결제 금액이 유효하지 않습니다.",
      detail: "잔여 이용일 기준 차액이 0원 이하입니다.",
    });
  }

  // 1) 차액 청구(이력) — 활성 구독 invoice는 1개만 유지해야 하므로 delta는 active로 두지 않는다.
  const deltaCode = newInvoiceCode("U");
  const deltaPayloadBase = {
    user_id: params.userId,
    invoice_code: deltaCode,
    plan_name: "프리미엄 요금제 (업그레이드 차액)",
    paid_at: now.toISOString(),
    usage_period_start: inv.usage_period_start,
    usage_period_end: inv.usage_period_end,
    amount_won: expected,
    payment_status: "completed",
    usage_status: "expired",
  } as const;

  let deltaInsert = await admin.from("member_billing_invoices").insert({
    ...deltaPayloadBase,
    refund_status: "none",
  } as never).select("id").maybeSingle();

  if (deltaInsert.error && isPgUndefinedColumn(deltaInsert.error)) {
    deltaInsert = await admin.from("member_billing_invoices").insert({
      ...deltaPayloadBase,
    } as never).select("id").maybeSingle();
  }

  if (deltaInsert.error) {
    // invoice_code 충돌 시 1회 재시도
    if (String((deltaInsert.error as { code?: string }).code) === "23505") {
      const deltaCode2 = newInvoiceCode("U");
      const retryPayload = { ...deltaPayloadBase, invoice_code: deltaCode2 };
      let deltaInsert2 = await admin.from("member_billing_invoices").insert({
        ...retryPayload,
        refund_status: "none",
      } as never).select("id").maybeSingle();
      if (deltaInsert2.error && isPgUndefinedColumn(deltaInsert2.error)) {
        deltaInsert2 = await admin.from("member_billing_invoices").insert({
          ...retryPayload,
        } as never).select("id").maybeSingle();
      }
      if (deltaInsert2.error) throw deltaInsert2.error;
      deltaInsert = deltaInsert2;
    } else {
      throw deltaInsert.error;
    }
  }

  const { error: upInvErr } = await admin
    .from("member_billing_invoices")
    .update({ plan_name: "프리미엄 요금제" })
    .eq("id", inv.id)
    .eq("user_id", params.userId)
    .eq("payment_status", "completed")
    .eq("usage_status", "active");
  if (upInvErr) throw upInvErr;

  // 업그레이드 완료 후 예약 컬럼은 비워둔다(프리미엄으로 즉시 반영).
  const { error: clrErr } = await admin
    .from("users")
    .update({
      billing_pending_plan_key: null,
      billing_pending_plan_effective_at: null,
    })
    .eq("id", params.userId);
  if (clrErr && !isPgUndefinedColumn(clrErr)) {
    throw clrErr;
  }

  return {
    success: true,
    upgraded: true,
    chargeWon: expected,
    activeInvoiceId: inv.id,
    deltaInvoiceId: (deltaInsert.data as { id?: string } | null)?.id,
  };
}

export type MemberPlanDowngradeScheduleResult = {
  success: true;
  scheduled: true;
  pendingPlanKey: "pro";
  effectiveAt: string;
};

export async function scheduleMemberPremiumToProDowngrade(params: {
  userId: string;
  now?: Date;
}): Promise<MemberPlanDowngradeScheduleResult> {
  const now = params.now ?? new Date();
  const admin = createServiceRoleClient();

  const { data: userRow, error: userErr } = await admin
    .from("users")
    .select(
      "is_admin, role, paid_at, paid_until, billing_pending_plan_key, billing_pending_plan_effective_at",
    )
    .eq("id", params.userId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow) {
    throw new AppBadRequestError({
      code: "PROFILE_NOT_FOUND",
      message: "사용자 정보를 찾을 수 없습니다.",
    });
  }

  assertPaidMember(userRow as UserRow, now);

  const paidUntilIso = (userRow as UserRow).paid_until ?? null;
  if (paidUntilIso == null || String(paidUntilIso).trim() === "") {
    throw new AppBadRequestError({
      code: "BILLING_PAID_UNTIL_MISSING",
      message: "구독 만료 시각(paid_until)이 없어 예약할 수 없습니다.",
    });
  }

  const inv = await fetchLatestActiveInvoice(params.userId);
  if (!inv) {
    throw new AppBadRequestError({
      code: "BILLING_ACTIVE_INVOICE_NOT_FOUND",
      message: "활성 구독 청구 정보를 찾을 수 없습니다.",
    });
  }

  const current = planKeyFromInvoicePlanName(inv.plan_name);
  if (current !== "premium") {
    throw new AppBadRequestError({
      code: "BILLING_PLAN_DOWNGRADE_NOT_APPLICABLE",
      message: "프리미엄 요금제에서만 다운그레이드 예약할 수 있습니다.",
    });
  }

  const pendingKey = (userRow as UserRow).billing_pending_plan_key ?? null;
  if (pendingKey === "pro") {
    return {
      success: true,
      scheduled: true,
      pendingPlanKey: "pro",
      effectiveAt: String(
        (userRow as UserRow).billing_pending_plan_effective_at ??
          paidUntilIso,
      ),
    };
  }
  if (pendingKey != null && String(pendingKey).trim() !== "") {
    throw new AppConflictError({
      code: "BILLING_PLAN_CHANGE_PENDING",
      message: "이미 다른 요금제 변경 예약이 있습니다.",
    });
  }

  const effectiveAt = String(paidUntilIso);

  const { error: upErr } = await admin
    .from("users")
    .update({
      billing_pending_plan_key: "pro",
      billing_pending_plan_effective_at: effectiveAt,
    })
    .eq("id", params.userId);
  if (upErr) {
    if (isPgUndefinedColumn(upErr)) {
      throw new AppBadRequestError({
        code: "BILLING_PENDING_COLUMNS_MISSING",
        message: "요금제 예약 컬럼이 DB에 아직 적용되지 않았습니다.",
        detail: "supabase migration 081_users_billing_plan_pending.sql 적용 필요",
      });
    }
    throw upErr;
  }

  return {
    success: true,
    scheduled: true,
    pendingPlanKey: "pro",
    effectiveAt,
  };
}

export type MemberPlanPendingCancelResult = { success: true; cleared: boolean };

export async function cancelMemberPendingBillingPlanChange(params: {
  userId: string;
}): Promise<MemberPlanPendingCancelResult> {
  const admin = createServiceRoleClient();
  const { error } = await admin
    .from("users")
    .update({
      billing_pending_plan_key: null,
      billing_pending_plan_effective_at: null,
    })
    .eq("id", params.userId);
  if (error) {
    if (isPgUndefinedColumn(error)) {
      return { success: true, cleared: false };
    }
    throw error;
  }
  return { success: true, cleared: true };
}
