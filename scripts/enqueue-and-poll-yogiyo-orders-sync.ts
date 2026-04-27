import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

function mustEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`missing env: ${key}`);
  return v;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const url = mustEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = mustEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const storeName = "샤오마라 마라탕&마라꼬치 명지점";
  const ordersWindow =
    process.env.ORDERS_WINDOW === "initial" ? ("initial" as const) : ("previous_kst_day" as const);
  const { data: stores, error: storesErr } = await supabase
    .from("stores")
    .select("id,user_id,name")
    .ilike("name", `%${storeName}%`);
  if (storesErr) throw storesErr;
  if (!stores || stores.length === 0) {
    console.log("store_not_found", { storeName });
    return;
  }

  const storeId = stores[0]!.id as string;
  const userId = stores[0]!.user_id as string;
  console.log("target_store", { storeId, userId, name: stores[0]!.name, ordersWindow });

  const payload = {
    trigger: "debug_script",
    ordersWindow,
  } as const;

  const { data: inserted, error: insErr } = await supabase
    .from("browser_jobs")
    .insert({
      type: "yogiyo_orders_sync",
      store_id: storeId,
      user_id: userId,
      status: "pending",
      payload,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insErr) throw insErr;

  const jobId = inserted.id as string;
  console.log("enqueued_job", { jobId, payload });

  const deadlineMs = Date.now() + 3 * 60 * 1000;
  for (;;) {
    const { data: job, error: jobErr } = await supabase
      .from("browser_jobs")
      .select("id,status,error_message,result_summary,created_at,updated_at")
      .eq("id", jobId)
      .maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) throw new Error(`job disappeared: ${jobId}`);

    const status = job.status as string;
    if (status === "completed" || status === "failed" || status === "cancelled") {
      const rs = job.result_summary as Record<string, unknown> | null;
      const settlementFetch =
        rs && typeof rs === "object"
          ? ((rs as { settlement_fetch?: unknown }).settlement_fetch ?? null)
          : null;
      console.log("job_done", {
        id: job.id,
        status: job.status,
        updated_at: job.updated_at,
        error_message: job.error_message,
        settlement_fetch: settlementFetch,
        result_summary_keys: rs ? Object.keys(rs) : null,
      });

      // 추가 확인: 최근 60일 요기요 dashboard_daily에서 settlement != total_pay가 있는지
      try {
        const { data: daily, error: dailyErr } = await supabase
          .from("store_platform_dashboard_daily")
          .select("kst_date,settlement_amount,total_pay_amount,order_count,updated_at")
          .eq("store_id", storeId)
          .eq("platform", "yogiyo")
          .order("kst_date", { ascending: false })
          .limit(60);
        if (dailyErr) throw dailyErr;
        const diff = (daily ?? []).filter(
          (r) =>
            r.settlement_amount != null &&
            r.total_pay_amount != null &&
            r.settlement_amount !== r.total_pay_amount,
        );
        console.log("dashboard_daily_diff_sample", {
          totalRows: daily?.length ?? 0,
          diffCount: diff.length,
          sample: diff.slice(0, 8),
        });
      } catch (e) {
        console.log("dashboard_daily_diff_sample", { skipped: true });
      }
      return;
    }

    if (Date.now() > deadlineMs) {
      console.log("job_timeout", { jobId, status, updated_at: job.updated_at });
      return;
    }
    await sleep(3000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

