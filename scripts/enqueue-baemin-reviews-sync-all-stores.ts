/**
 * 1회용/운영용: 여러 매장에 대해 배민 리뷰 `baemin_sync` job을 일괄 enqueue.
 *
 * 목적:
 * - 배민 리뷰 작성일(`written_at`) 파싱/매핑이 변경되었을 때, 기존 데이터가 `written_at = NULL`로 쌓인 경우
 *   전체 매장을 한 번 다시 sync 해서 대시보드 집계(기간 필터)가 살아나게 함.
 *
 * 실행:
 * - pnpm run script:enqueue-baemin-reviews-sync
 *
 * 옵션:
 * - --dry-run  (job 생성 없이 대상만 출력)
 *
 * env:
 * - BULK_BAEMIN_REVIEWS_SYNC_WINDOW=ongoing|initial (기본: ongoing=최근 30일, initial=최근 180일)
 * - BULK_BAEMIN_REVIEWS_FETCH_ALL=1 (기본: 1)  → 브라우저 스크롤로 가능한 한 끝까지 수집
 * - BULK_BAEMIN_REVIEWS_SKIP_PENDING=1 (기본) → 동일 store+type pending이면 스킵
 * - BULK_BAEMIN_REVIEWS_STORE_IDS (선택, 콤마 구분 UUID) → 이 store_id만 대상
 * - BULK_BAEMIN_REVIEWS_USER_IDS (선택, 콤마 구분 UUID) → 이 user_id만 대상
 *
 * 주의:
 * - 큐에만 넣고, 실제 수집은 워커(worker:reviews 또는 worker)가 처리한다.
 * - 대량 enqueue 후에는 워커 동시성/레이트리밋에 주의.
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";
import {
  getReviewSyncWindowDateRangeFormatted,
  type ReviewSyncWindow,
} from "@/lib/utils/review-date-range";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

const JOB_TYPE = "baemin_sync" as const;
const TRIGGER = "script_enqueue_baemin_reviews_sync";

function parseDryRun(argv: string[]): boolean {
  return argv.includes("--dry-run");
}

function parseCsvEnvSet(key: string): Set<string> | null {
  const raw = process.env[key]?.trim();
  if (!raw) return null;
  const items = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? new Set(items) : null;
}

function resolveSyncWindow(): ReviewSyncWindow {
  const raw = (process.env.BULK_BAEMIN_REVIEWS_SYNC_WINDOW ?? "")
    .trim()
    .toLowerCase();
  return raw === "initial" ? "initial" : "ongoing";
}

async function hasPendingBaeminSyncJob(
  supabase: ReturnType<typeof createServiceRoleClient>,
  storeId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("id")
    .eq("store_id", storeId)
    .eq("type", JOB_TYPE)
    .eq("status", "pending")
    .limit(1);
  if (error) throw new Error(`browser_jobs pending check: ${error.message}`);
  return (data ?? []).length > 0;
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));
  const skipPending = process.env.BULK_BAEMIN_REVIEWS_SKIP_PENDING !== "0";
  const fetchAll = process.env.BULK_BAEMIN_REVIEWS_FETCH_ALL !== "0";
  const syncWindow = resolveSyncWindow();
  const storeIdAllowlist = parseCsvEnvSet("BULK_BAEMIN_REVIEWS_STORE_IDS");
  const userIdAllowlist = parseCsvEnvSet("BULK_BAEMIN_REVIEWS_USER_IDS");

  const { from, to } = getReviewSyncWindowDateRangeFormatted(syncWindow);
  const supabase = createServiceRoleClient();

  const { data: sessions, error: sessErr } = await supabase
    .from("store_platform_sessions")
    .select("store_id")
    .eq("platform", "baemin");
  if (sessErr) throw new Error(`store_platform_sessions: ${sessErr.message}`);

  const sessionStoreIds = new Set(
    (sessions ?? [])
      .map((r) => (r as { store_id?: unknown }).store_id)
      .filter((v): v is string => typeof v === "string" && v.trim() !== "")
      .map((v) => v.trim()),
  );

  const { data: stores, error: storesErr } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .in("id", [...sessionStoreIds]);
  if (storesErr) throw new Error(`stores: ${storesErr.message}`);

  let targetStores = (stores ?? []).filter((s) => {
    const id = s.id as string | null;
    const uid = s.user_id as string | null;
    if (!id || !uid) return false;
    if (storeIdAllowlist && !storeIdAllowlist.has(id)) return false;
    if (userIdAllowlist && !userIdAllowlist.has(uid)) return false;
    return true;
  });

  // deterministic order
  targetStores = targetStores.sort((a, b) =>
    String(a.id).localeCompare(String(b.id)),
  );

  let enqueuedOrSimulated = 0;
  let skippedPending = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const store of targetStores) {
    const storeId = store.id as string;
    const userId = store.user_id as string;
    const name = (store.name as string | null) ?? null;
    try {
      if (skipPending && (await hasPendingBaeminSyncJob(supabase, storeId))) {
        skippedPending += 1;
        continue;
      }
      if (dryRun) {
        console.log("[dry-run] would enqueue", {
          storeId,
          name,
          userId,
          type: JOB_TYPE,
          from,
          to,
          fetchAll,
          syncWindow,
        });
        enqueuedOrSimulated += 1;
        continue;
      }

      const jobId = await createBrowserJobWithServiceRole(
        JOB_TYPE,
        storeId,
        userId,
        {
          from,
          to,
          offset: "0",
          limit: "10",
          fetchAll,
          syncWindow,
          trigger: TRIGGER,
        },
      );
      jobIds.push(jobId);
      enqueuedOrSimulated += 1;
      console.log("enqueued", {
        jobId,
        storeId,
        name,
        userId,
        type: JOB_TYPE,
        syncWindow,
      });
    } catch (e) {
      failed += 1;
      console.error("enqueue failed", { storeId, name, userId }, e);
    }
  }

  console.log("[enqueue-baemin-reviews-sync-all-stores] done", {
    dryRun,
    syncWindow,
    from,
    to,
    fetchAll,
    skipPending,
    storeIdAllowlist: storeIdAllowlist ? [...storeIdAllowlist] : null,
    userIdAllowlist: userIdAllowlist ? [...userIdAllowlist] : null,
    targetStoreCount: targetStores.length,
    jobsEnqueuedOrSimulated: enqueuedOrSimulated,
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

