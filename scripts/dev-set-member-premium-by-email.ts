/**
 * DEV/스테이징: 이메일로 public.users 를 찾아 유료(프리미엄) 구독 UI 확인용 상태로 맞춘다.
 *
 * - users: paid_at / paid_until / cancel 해지플래그 정리 / (선택) 카드 마스킹
 * - member_billing_invoices: 기존 active → expired 후 프리미엄 active 1건 insert
 *
 * run:
 *   pnpm exec tsx --no-cache scripts/dev-set-member-premium-by-email.ts bizplatformofficial@gmail.com
 *   pnpm exec tsx --no-cache scripts/dev-set-member-premium-by-email.ts bizplatformofficial@gmail.com --as-member
 *
 * flags:
 *   --as-member  구독/온보딩 UI를 일반 멤버 유료 트랙으로 보기 위해 is_admin=false 로 맞춤
 *
 * env: .env.local 의 SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

function newInvoiceCode(): string {
  const raw = crypto.randomUUID().replaceAll("-", "");
  return `PREMUI-${raw.slice(0, 22)}`.slice(0, 30);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).map((x) => x.trim());
  const asMember = argv.includes("--as-member");
  const email = argv.find((x) => x.length > 0 && !x.startsWith("--")) ?? "";
  if (!email) {
    console.error(
      "Usage: pnpm exec tsx --no-cache scripts/dev-set-member-premium-by-email.ts <email> [--as-member]",
    );
    process.exit(1);
  }

  const supabase = createServiceRoleClient();

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id, email")
    .ilike("email", email)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow?.id) {
    console.error(`No public.users row for email=${email}`);
    process.exit(1);
  }

  const userId = userRow.id as string;
  const paidAt = new Date();
  const paidUntil = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

  const { error: uErr } = await supabase
    .from("users")
    .update({
      paid_at: paidAt.toISOString(),
      paid_until: paidUntil.toISOString(),
      cancel_at_period_end: false,
      billing_pending_plan_key: null,
      billing_pending_plan_effective_at: null,
      payment_card_bin4: "5322",
      payment_card_last4: "2234",
      ...(asMember ? { is_admin: false } : {}),
    })
    .eq("id", userId);
  if (uErr) throw uErr;

  const { error: expErr } = await supabase
    .from("member_billing_invoices")
    .update({ usage_status: "expired" })
    .eq("user_id", userId)
    .eq("usage_status", "active");
  if (expErr) throw expErr;

  const usageStart = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
  const usageEnd = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000);

  const baseRow = {
    user_id: userId,
    invoice_code: newInvoiceCode(),
    plan_name: "프리미엄 요금제",
    paid_at: paidAt.toISOString(),
    usage_period_start: usageStart.toISOString(),
    usage_period_end: usageEnd.toISOString(),
    amount_won: 22_000,
    payment_status: "completed" as const,
    usage_status: "active" as const,
  };

  let ins = await supabase.from("member_billing_invoices").insert({
    ...baseRow,
    refund_status: "eligible",
  } as never);
  if (ins.error && String((ins.error as { code?: string }).code) === "42703") {
    ins = await supabase.from("member_billing_invoices").insert(baseRow);
  }
  if (ins.error) throw ins.error;

  console.log("[dev-set-member-premium-by-email] OK", {
    userId,
    email: userRow.email,
    paid_until: paidUntil.toISOString(),
    invoice_code: baseRow.invoice_code,
    asMember,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
