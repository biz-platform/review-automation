/**
 * 결제 관리 화면 확인용: 카드 마스킹 + 청구 샘플 3건 (피그마 예시와 유사).
 *
 * run: pnpm run seed:sample-billing -- <users.id UUID>
 * env: .env.local 의 SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL
 *
 * 기존 `invoice_code`가 `A-DEMO-001` ~ `003` 인 행은 같은 user_id 에 대해 삭제 후 다시 넣음.
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

const DEMO_CODES = ["A-DEMO-001", "A-DEMO-002", "A-DEMO-003"] as const;

async function main(): Promise<void> {
  const userId = process.argv
    .slice(2)
    .map((x) => x.trim())
    .find((x) => x.length > 0 && x !== "--");
  if (!userId) {
    console.error(
      "Usage: pnpm run seed:sample-billing -- <users.id UUID>\n" +
        "Supabase Table Editor → users 에서 id 복사",
    );
    process.exit(1);
  }

  const supabase = createServiceRoleClient();

  const { data: userRow, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!userRow) {
    console.error(`No user row for id=${userId}`);
    process.exit(1);
  }

  const { error: cardErr } = await supabase
    .from("users")
    .update({
      role: "member",
      paid_at: null,
      paid_until: null,
      payment_card_bin4: "5322",
      payment_card_last4: "2234",
    })
    .eq("id", userId);
  if (cardErr) throw cardErr;

  await supabase
    .from("member_billing_invoices")
    .delete()
    .eq("user_id", userId)
    .in("invoice_code", [...DEMO_CODES]);

  const now = new Date();
  const paidWithinRefundWindow = new Date(
    now.getTime() - 2 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const rows = [
    {
      user_id: userId,
      invoice_code: "A-DEMO-001",
      plan_name: "프리미엄 요금제",
      paid_at: paidWithinRefundWindow,
      usage_period_start: "2026-01-01T00:00:00+09:00",
      usage_period_end: "2026-01-31T23:59:59+09:00",
      amount_won: 22_000,
      payment_status: "completed" as const,
      usage_status: "active" as const,
      refund_status: "eligible" as const,
    },
    {
      user_id: userId,
      invoice_code: "A-DEMO-002",
      plan_name: "프리미엄 요금제",
      paid_at: "2025-12-01T13:02:00+09:00",
      usage_period_start: "2025-12-01T00:00:00+09:00",
      usage_period_end: "2025-12-31T23:59:59+09:00",
      amount_won: 22_000,
      payment_status: "error" as const,
      usage_status: "suspended" as const,
      refund_status: "none" as const,
    },
    {
      user_id: userId,
      invoice_code: "A-DEMO-003",
      plan_name: "프리미엄 요금제",
      paid_at: "2025-12-01T13:02:00+09:00",
      usage_period_start: "2025-11-01T00:00:00+09:00",
      usage_period_end: "2025-11-30T23:59:59+09:00",
      amount_won: 22_000,
      payment_status: "completed" as const,
      usage_status: "expired" as const,
      refund_status: "ineligible" as const,
    },
  ];

  const { error: insErr } = await supabase
    .from("member_billing_invoices")
    .insert(rows);
  if (insErr) throw insErr;

  console.log(
    "[seed-sample-billing] OK user=%s card=5322-****-****-2234 invoices=%s",
    userId,
    DEMO_CODES.join(", "),
  );

  console.log("\n[seed-sample-billing] 다음으로 크론 강제 테스트(DEV 전용 now 주입):");
  console.log(
    `- D-3: curl -H 'authorization: Bearer ${process.env.CRON_SECRET ?? "<CRON_SECRET>"}' ` +
      `'http://localhost:3000/api/cron/member-billing-alimtalk?now=2026-05-29T00:10:00%2B09:00'`,
  );
  console.log(
    `- 당일: curl -H 'authorization: Bearer ${process.env.CRON_SECRET ?? "<CRON_SECRET>"}' ` +
      `'http://localhost:3000/api/cron/member-billing-alimtalk?now=2026-06-01T00:10:00%2B09:00'`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
