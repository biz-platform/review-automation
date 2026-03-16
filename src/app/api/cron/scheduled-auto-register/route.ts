import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";
import { getDefaultReviewDateRangeFormatted } from "@/lib/utils/review-date-range";

const PLATFORM_TO_SYNC_TYPE = {
  baemin: "baemin_sync" as const,
  yogiyo: "yogiyo_sync" as const,
  ddangyo: "ddangyo_sync" as const,
  coupang_eats: "coupang_eats_sync" as const,
};

/** KST(Asia/Seoul) 0~23 */
function getCurrentHourKst(): number {
  const now = new Date();
  const kst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return kst.getHours();
}

function getSyncPayload(platform: string): Record<string, unknown> {
  if (platform === "baemin") {
    const { from, to } = getDefaultReviewDateRangeFormatted();
    return { from, to, offset: "0", limit: "10", fetchAll: true };
  }
  return {};
}

/**
 * Vercel Cron에서 매시 호출. 해당 시각(KST)에 자동 등록이 설정된 매장에 대해
 * sync job만 생성. 워커가 sync 완료 후 결과 적용 시, 자동 등록 매장의 미답변 리뷰(초안 있는 것)에 대해 register_reply job을 자동 생성.
 * CRON_SECRET으로 호출 검증.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hour = getCurrentHourKst();
  const supabase = createServiceRoleClient();

  const { data: toneRows, error: toneError } = await supabase
    .from("tone_settings")
    .select("store_id")
    .eq("comment_register_mode", "auto")
    .eq("auto_register_scheduled_hour", hour);

  if (toneError) {
    console.error("[cron/scheduled-auto-register] tone_settings query", toneError);
    return NextResponse.json(
      { error: "tone_settings query failed", detail: toneError.message },
      { status: 500 }
    );
  }

  if (!toneRows?.length) {
    return NextResponse.json({
      ok: true,
      hour,
      storeIds: [],
      jobsCreated: 0,
      message: "No stores scheduled for this hour",
    });
  }

  const storeIds = toneRows.map((r) => r.store_id as string);

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, user_id")
    .in("id", storeIds);

  if (storesError || !stores?.length) {
    return NextResponse.json({
      ok: true,
      hour,
      storeIds: [],
      jobsCreated: 0,
      message: "Stores not found or error",
    });
  }

  const storeById = new Map(stores.map((s) => [s.id, s]));

  const { data: sessions, error: sessionsError } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform")
    .in("store_id", storeIds);

  if (sessionsError) {
    console.error("[cron/scheduled-auto-register] sessions query", sessionsError);
    return NextResponse.json(
      { error: "store_platform_sessions query failed" },
      { status: 500 }
    );
  }

  const jobsCreated: string[] = [];
  const syncTypes = new Set(Object.values(PLATFORM_TO_SYNC_TYPE));

  for (const row of sessions ?? []) {
    const storeId = row.store_id as string;
    const platform = (row.platform as string)?.toLowerCase();
    const jobType = platform ? PLATFORM_TO_SYNC_TYPE[platform as keyof typeof PLATFORM_TO_SYNC_TYPE] : null;
    if (!jobType || !syncTypes.has(jobType)) continue;

    const store = storeById.get(storeId);
    if (!store?.user_id) continue;

    try {
      const payload = { ...getSyncPayload(platform), trigger: "cron" as const };
      const id = await createBrowserJobWithServiceRole(
        jobType,
        storeId,
        store.user_id as string,
        payload
      );
      jobsCreated.push(id);
    } catch (e) {
      console.error(
        "[cron/scheduled-auto-register] create job failed",
        { storeId, platform },
        e
      );
    }
  }

  return NextResponse.json({
    ok: true,
    hour,
    storeIds,
    jobsCreated: jobsCreated.length,
    jobIds: jobsCreated,
  });
}
