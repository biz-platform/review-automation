import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

function mustEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing env: ${key}`);
  return v;
}

async function main() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const name = "샤오마라 마라탕&마라꼬치 명지점";
  const { data: stores, error: storesErr } = await supabase
    .from("stores")
    .select("id,user_id,name")
    .ilike("name", `%${name}%`);
  if (storesErr) throw storesErr;

  console.log("stores_matches", stores);
  if (!stores || stores.length === 0) return;

  const storeId = stores[0]!.id as string;

  const { data: sess, error: sessErr } = await supabase
    .from("store_platform_sessions")
    .select(
      "store_id,platform,business_registration_number,external_shop_id,updated_at",
    )
    .eq("store_id", storeId)
    .eq("platform", "yogiyo")
    .maybeSingle();
  if (sessErr) throw sessErr;
  console.log("yogiyo_session", sess);

  const { data: jobs, error: jobErr } = await supabase
    .from("browser_jobs")
    .select(
      "id,status,type,created_at,updated_at,error_message,payload,result_summary",
    )
    .eq("store_id", storeId)
    .eq("type", "yogiyo_orders_sync")
    .order("created_at", { ascending: false })
    .limit(5);
  if (jobErr) throw jobErr;

  console.log(
    "yogiyo_orders_sync_recent",
    (jobs ?? []).map((j) => ({
      id: j.id,
      status: j.status,
      created_at: j.created_at,
      updated_at: j.updated_at,
      has_error: !!j.error_message,
      error_message: j.error_message
        ? String(j.error_message).slice(0, 200)
        : null,
      result_summary_keys: j.result_summary ? Object.keys(j.result_summary) : null,
      payload_keys: j.payload ? Object.keys(j.payload) : null,
    })),
  );

  const { data: daily, error: dailyErr } = await supabase
    .from("store_platform_dashboard_daily")
    .select(
      "kst_date,settlement_amount,total_pay_amount,order_count,platform_shop_external_id,updated_at",
    )
    .eq("store_id", storeId)
    .eq("platform", "yogiyo")
    .order("kst_date", { ascending: false })
    .limit(60);
  if (dailyErr) throw dailyErr;

  const zerosOrNull = (daily ?? []).filter(
    (r) => r.settlement_amount == null || r.settlement_amount === 0,
  ).length;
  const diffCount = (daily ?? []).filter(
    (r) =>
      r.settlement_amount != null &&
      r.total_pay_amount != null &&
      r.settlement_amount !== r.total_pay_amount,
  ).length;

  console.log("dashboard_daily_last60", {
    rows: daily?.length ?? 0,
    zerosOrNull,
    diffCount,
    sample: (daily ?? []).slice(0, 8),
  });

  // (선택) work_logs가 있으면 정산 fetch 로그를 찾는다.
  try {
    const { data: logs, error: logsErr } = await supabase
      .from("work_logs")
      .select("id, created_at, store_id, type, message")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (logsErr) throw logsErr;
    const settlementHits =
      (logs ?? [])
        .filter((l) => String(l.message ?? "").toLowerCase().includes("settlement"))
        .slice(0, 10) ?? [];
    console.log("work_logs_settlement_hits", settlementHits);
  } catch (e) {
    console.log("work_logs_settlement_hits", { skipped: true });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

