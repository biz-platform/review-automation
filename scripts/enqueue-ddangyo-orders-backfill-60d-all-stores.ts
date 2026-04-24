/**
 * 1회용: 모든 매장에 대해 땡겨요만 `ordersWindow: "initial"`(기본 60일) 주문 동기화 job을 큐에 넣음.
 *
 * 실행:
 * - pnpm run script:enqueue-ddangyo-orders-backfill-60d
 *
 * 옵션:
 * - --dry-run  (job 생성 없이 대상만 출력)
 *
 * env:
 * - BULK_DDANGYO_BACKFILL_SKIP_PENDING=1 (기본) → 동일 store+type pending 이고 payload.ordersWindow===initial 이면 스킵
 * - BULK_DDANGYO_BACKFILL_SKIP_PENDING=0 → pending 중복도 또 넣음
 * - BULK_DDANGYO_BACKFILL_STORE_IDS (선택, 콤마 구분 UUID) → 이 store_id 만 대상 (부분 백필)
 * - BULK_DDANGYO_BACKFILL_EXCLUDE_USER_IDS (선택, 콤마 구분 UUID) → 해당 user_id 의 매장 제외
 *
 * NOTE:
 * - 실제 조회 기간(N일)은 워커 env `DDANGYO_ORDERS_INITIAL_DAYS_BACK`로 결정됨(기본 60).
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

const JOB_TYPE = "ddangyo_orders_sync" as const;
const TRIGGER = "script_enqueue_ddangyo_orders_backfill_60d";

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

function parseStoreIdAllowlist(): Set<string> | null {
  const raw = process.env.BULK_DDANGYO_BACKFILL_STORE_IDS?.trim();
  if (!raw) return null;
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? new Set(ids) : null;
}

function parseExcludedUserIds(): Set<string> {
  const raw = process.env.BULK_DDANGYO_BACKFILL_EXCLUDE_USER_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

async function hasPendingInitialJob(args: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  storeId: string;
}): Promise<boolean> {
  const { supabase, storeId } = args;
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("id, payload")
    .eq("store_id", storeId)
    .eq("type", JOB_TYPE)
    .eq("status", "pending")
    .limit(20);
  if (error) throw new Error(`browser_jobs pending check: ${error.message}`);
  return (data ?? []).some((row) => {
    const p = row.payload as Record<string, unknown> | null;
    return p?.ordersWindow === "initial";
  });
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));
  const skipPending = process.env.BULK_DDANGYO_BACKFILL_SKIP_PENDING !== "0";
  const storeIdAllowlist = parseStoreIdAllowlist();
  const excludedUserIds = parseExcludedUserIds();

  const supabase = createServiceRoleClient();

  const { data: allStores, error: storesError } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .order("created_at", { ascending: true });
  if (storesError) throw new Error(`stores: ${storesError.message}`);

  let targetStores = (allStores ?? []).filter(
    (s) =>
      typeof s.user_id === "string" &&
      s.user_id.length > 0 &&
      !excludedUserIds.has(s.user_id),
  );
  if (storeIdAllowlist) {
    targetStores = targetStores.filter((s) =>
      storeIdAllowlist.has(s.id as string),
    );
  }

  const { data: sessions, error: sessError } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform")
    .eq("platform", "ddangyo");
  if (sessError)
    throw new Error(`store_platform_sessions: ${sessError.message}`);

  const hasDdangyoSession = new Set<string>(
    (sessions ?? []).map((r) => r.store_id as string).filter(Boolean),
  );

  let created = 0;
  let skippedNoSession = 0;
  let skippedPending = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const store of targetStores) {
    const storeId = store.id as string;
    const userId = store.user_id as string;
    if (!hasDdangyoSession.has(storeId)) {
      skippedNoSession += 1;
      continue;
    }

    try {
      if (skipPending && (await hasPendingInitialJob({ supabase, storeId }))) {
        skippedPending += 1;
        continue;
      }

      if (dryRun) {
        console.log("[dry-run] would enqueue", {
          storeId,
          name: store.name,
          userId,
          jobType: JOB_TYPE,
        });
        created += 1;
        continue;
      }

      const id = await createBrowserJobWithServiceRole(
        JOB_TYPE,
        storeId,
        userId,
        {
          ordersWindow: "initial",
          trigger: TRIGGER,
        },
      );
      jobIds.push(id);
      created += 1;
      console.log("enqueued", {
        jobId: id,
        storeId,
        name: store.name,
        jobType: JOB_TYPE,
      });
    } catch (e) {
      failed += 1;
      console.error(
        "enqueue failed",
        { storeId, name: store.name, jobType: JOB_TYPE },
        e,
      );
    }
  }

  console.log("[enqueue-ddangyo-orders-backfill-60d] done", {
    dryRun,
    storeIdAllowlist: storeIdAllowlist ? [...storeIdAllowlist] : null,
    excludedUserCount: excludedUserIds.size,
    excludedUserIds: [...excludedUserIds],
    targetStoreCount: targetStores.length,
    storesWithDdangyoSession: hasDdangyoSession.size,
    jobsCreatedOrSimulated: created,
    skippedNoSession,
    skippedPending,
    failed,
    jobIdsSample: jobIds.slice(0, 15),
    jobIdsTotal: jobIds.length,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

