/**
 * dev: ddangyo 대시보드에서 매출/정산 분리 여부 빠른 확인
 *
 * 실행:
 * - STORE_ID=... pnpm run -s dev:check-ddangyo-dashboard-settlement
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

async function main(): Promise<void> {
  const storeId = process.env.STORE_ID?.trim();
  const all = process.env.ALL?.trim() === "1";

  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const sinceYmd = `${since.getUTCFullYear()}-${String(since.getUTCMonth() + 1).padStart(2, "0")}-${String(since.getUTCDate()).padStart(2, "0")}`;

  const storeIds: string[] = [];
  if (all) {
    const { data: sessions, error: sessErr } = await supabase
      .from("store_platform_sessions")
      .select("store_id")
      .eq("platform", "ddangyo");
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

  const results: any[] = [];
  for (const sid of uniq) {
    const { data: rows90, error: rows90Err } = await supabase
      .from("store_platform_dashboard_daily")
      .select("kst_date, total_pay_amount, settlement_amount")
      .eq("store_id", sid)
      .eq("platform", "ddangyo")
      .gte("kst_date", sinceYmd)
      .limit(5000);
    if (rows90Err) throw new Error(rows90Err.message);
    const list90 = rows90 ?? [];
    let totalPaySum = 0;
    let settlementSum = 0;
    let diffRows = 0;
    for (const r of list90) {
      if (typeof r.total_pay_amount === "number") totalPaySum += r.total_pay_amount;
      if (typeof r.settlement_amount === "number") settlementSum += r.settlement_amount;
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
      rowCount: list90.length,
      totalPaySum,
      settlementSum,
      diffRows,
      hasDiff: diffRows > 0,
    });
  }

  results.sort((a, b) => Number(b.hasDiff) - Number(a.hasDiff));
  console.log("[ddangyo dashboard settlement check]", { count: results.length, results });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

