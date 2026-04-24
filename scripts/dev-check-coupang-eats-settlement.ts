/**
 * dev: 쿠팡이츠 정산(순액) 수집/반영 여부 확인
 *
 * 체크 포인트:
 * - store_platform_orders.actually_amount (nonnull/total)
 * - store_platform_dashboard_daily (total_pay_amount vs settlement_amount diffRows)
 *
 * 실행:
 * - ALL=1 pnpm -s run dev:check-coupang-eats-settlement
 * - STORE_ID=... pnpm -s run dev:check-coupang-eats-settlement
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

async function main(): Promise<void> {
  const all = process.env.ALL?.trim() === "1";
  const storeId = process.env.STORE_ID?.trim();

  const supabase = createServiceRoleClient();

  const storeIds: string[] = [];
  if (all) {
    const { data: sessions, error: sessErr } = await supabase
      .from("store_platform_sessions")
      .select("store_id")
      .eq("platform", "coupang_eats");
    if (sessErr) throw new Error(sessErr.message);
    for (const r of sessions ?? []) {
      const id = r.store_id as string;
      if (id) storeIds.push(id);
    }
  } else {
    if (!storeId) throw new Error("STORE_ID env가 필요함 (또는 ALL=1)");
    storeIds.push(storeId);
  }

  const uniq = [...new Set(storeIds)];
  const { data: stores, error: stErr } = await supabase
    .from("stores")
    .select("id, name")
    .in("id", uniq);
  if (stErr) throw new Error(stErr.message);
  const nameById = new Map<string, string>(
    (stores ?? []).map((s) => [s.id as string, (s.name as string) ?? ""]),
  );

  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sinceYmd = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(2, "0")}-${String(since.getUTCDate()).padStart(2, "0")}`;

  const results: any[] = [];
  for (const sid of uniq) {
    // Orders ledger: actually_amount 존재 여부
    const { data: shopRows, error: shopErr } = await supabase
      .from("store_platform_shops")
      .select("id")
      .eq("store_id", sid)
      .eq("platform", "coupang_eats");
    if (shopErr) throw new Error(shopErr.message);
    const shopIds = (shopRows ?? []).map((r) => r.id as string).filter(Boolean);

    let orderRowCount = 0;
    let actuallyNonNull = 0;
    if (shopIds.length > 0) {
      const { data: orders, error: oErr } = await supabase
        .from("store_platform_orders")
        .select("actually_amount, order_at")
        .in("store_platform_shop_id", shopIds)
        .eq("platform", "coupang_eats")
        .gte("order_at", `${sinceYmd}T00:00:00.000Z`)
        .limit(10000);
      if (oErr) throw new Error(oErr.message);
      const list = orders ?? [];
      orderRowCount = list.length;
      actuallyNonNull = list.filter(
        (r) => typeof r.actually_amount === "number",
      ).length;
    }

    // Dashboard daily diff 여부
    const { data: daily, error: dErr } = await supabase
      .from("store_platform_dashboard_daily")
      .select("kst_date, total_pay_amount, settlement_amount")
      .eq("store_id", sid)
      .eq("platform", "coupang_eats")
      .gte("kst_date", sinceYmd)
      .limit(5000);
    if (dErr) throw new Error(dErr.message);
    const dailyList = daily ?? [];
    let diffRows = 0;
    for (const r of dailyList) {
      if (
        typeof r.total_pay_amount === "number" &&
        typeof r.settlement_amount === "number" &&
        r.total_pay_amount !== r.settlement_amount
      ) {
        diffRows += 1;
      }
    }

    results.push({
      storeId: sid,
      name: nameById.get(sid) ?? "",
      sinceYmd,
      coupangShopCount: shopIds.length,
      orderRowCount90d: orderRowCount,
      actuallyNonNull90d: actuallyNonNull,
      actuallyNonNullRate90d:
        orderRowCount > 0 ? actuallyNonNull / orderRowCount : null,
      dashboardRowCount90d: dailyList.length,
      dashboardDiffRows90d: diffRows,
      hasDashboardDiff: diffRows > 0,
    });
  }

  results.sort((a, b) => (b.hasDashboardDiff ? 1 : 0) - (a.hasDashboardDiff ? 1 : 0));
  console.log("[coupang_eats settlement check]", {
    count: results.length,
    results,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

