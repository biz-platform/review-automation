/**
 * 1회용: (특정 매장명을 가진 계정 제외) 모든 매장에 대해
 * 연동된 배민·요기요·땡겨요 각각 `ordersWindow: "initial"` 주문 동기화 job을 큐에 넣음.
 * 샵인샵(다중 점포)은 플랫폼별 1 job이 store 단위로 전 점포를 순회하는 기존 워커 동작에 맡김.
 *
 * 실행: pnpm run script:enqueue-orders-initial-backfill
 * 옵션: --dry-run  (job 생성 없이 대상만 출력)
 *
 * env:
 * - BULK_ORDERS_INITIAL_EXCLUDE_STORE_SUBSTRINGS (선택, 콤마 구분)
 *   → 각 substring 에 대해 `stores.name` ILIKE `%…%` 인 행의 user_id 합집합 제외
 * - BULK_ORDERS_INITIAL_EXCLUDE_STORE_SUBSTRING (단일, 기본: "허세김밥 상남본점")
 *   → SUBSTRINGS 가 없을 때만 사용 (DB 매장명이 다르면 SUBSTRINGS 또는 USER_IDS 로 맞출 것)
 * - BULK_ORDERS_INITIAL_EXCLUDE_USER_IDS  (선택, 콤마 구분 UUID) → 위보다 우선 적용
 * - BULK_ORDERS_INITIAL_SKIP_PENDING=1 (기본) → 동일 store+type 에 pending 이고 payload.ordersWindow===initial 이면 스킵
 * - BULK_ORDERS_INITIAL_SKIP_PENDING=0 → pending 중복도 또 넣음
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config();
} catch {
  /* no dotenv */
}

const ORDER_PLATFORMS = ["baemin", "yogiyo", "ddangyo"] as const;
type OrderPlatform = (typeof ORDER_PLATFORMS)[number];

const JOB_TYPE: Record<OrderPlatform, "baemin_orders_sync" | "yogiyo_orders_sync" | "ddangyo_orders_sync"> =
  {
    baemin: "baemin_orders_sync",
    yogiyo: "yogiyo_orders_sync",
    ddangyo: "ddangyo_orders_sync",
  };

const TRIGGER = "script_enqueue_orders_initial_backfill";

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

async function resolveExcludedUserIds(supabase: ReturnType<typeof createServiceRoleClient>): Promise<Set<string>> {
  const fromEnv = process.env.BULK_ORDERS_INITIAL_EXCLUDE_USER_IDS?.trim();
  if (fromEnv) {
    return new Set(
      fromEnv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );
  }
  const multi = process.env.BULK_ORDERS_INITIAL_EXCLUDE_STORE_SUBSTRINGS?.trim();
  const singles = multi
    ? multi
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [
        process.env.BULK_ORDERS_INITIAL_EXCLUDE_STORE_SUBSTRING?.trim() ?? "허세김밥 상남본점",
      ];

  const out = new Set<string>();
  for (const sub of singles) {
    const { data, error } = await supabase.from("stores").select("user_id").ilike("name", `%${sub}%`);
    if (error) throw new Error(`stores exclude query (${sub}): ${error.message}`);
    for (const r of data ?? []) {
      const uid = r.user_id as string;
      if (uid) out.add(uid);
    }
  }
  return out;
}

async function hasPendingInitialOrderJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  storeId: string,
  jobType: (typeof JOB_TYPE)[OrderPlatform],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("id, payload")
    .eq("store_id", storeId)
    .eq("type", jobType)
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
  const skipPending = process.env.BULK_ORDERS_INITIAL_SKIP_PENDING !== "0";

  const supabase = createServiceRoleClient();
  const excludedUserIds = await resolveExcludedUserIds(supabase);

  const { data: allStores, error: storesError } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .order("created_at", { ascending: true });
  if (storesError) throw new Error(`stores: ${storesError.message}`);

  const targetStores = (allStores ?? []).filter(
    (s) => typeof s.user_id === "string" && s.user_id.length > 0 && !excludedUserIds.has(s.user_id),
  );

  const { data: sessions, error: sessError } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform");
  if (sessError) throw new Error(`store_platform_sessions: ${sessError.message}`);

  const platformsByStore = new Map<string, Set<OrderPlatform>>();
  for (const row of sessions ?? []) {
    const sid = row.store_id as string;
    const p = row.platform as string;
    if (!ORDER_PLATFORMS.includes(p as OrderPlatform)) continue;
    const pl = p as OrderPlatform;
    if (!platformsByStore.has(sid)) platformsByStore.set(sid, new Set());
    platformsByStore.get(sid)!.add(pl);
  }

  let created = 0;
  let skippedNoPlatforms = 0;
  let skippedPending = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const store of targetStores) {
    const storeId = store.id as string;
    const userId = store.user_id as string;
    const platforms = platformsByStore.get(storeId);
    if (!platforms || platforms.size === 0) {
      skippedNoPlatforms += 1;
      continue;
    }

    for (const platform of platforms) {
      const jobType = JOB_TYPE[platform];
      try {
        if (skipPending && (await hasPendingInitialOrderJob(supabase, storeId, jobType))) {
          skippedPending += 1;
          continue;
        }
        if (dryRun) {
          console.log("[dry-run] would enqueue", {
            storeId,
            name: store.name,
            userId,
            platform,
            jobType,
          });
          created += 1;
          continue;
        }
        const id = await createBrowserJobWithServiceRole(jobType, storeId, userId, {
          ordersWindow: "initial",
          trigger: TRIGGER,
        });
        jobIds.push(id);
        created += 1;
        console.log("enqueued", { jobId: id, storeId, name: store.name, platform, jobType });
      } catch (e) {
        failed += 1;
        console.error("enqueue failed", { storeId, name: store.name, platform, jobType }, e);
      }
    }
  }

  console.log("[enqueue-orders-initial-backfill] done", {
    dryRun,
    excludedUserCount: excludedUserIds.size,
    excludedUserIds: [...excludedUserIds],
    targetStoreCount: targetStores.length,
    jobsCreatedOrSimulated: created,
    skippedNoPlatforms,
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
