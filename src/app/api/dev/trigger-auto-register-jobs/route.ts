import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";
import { storeHasReviewsForPlatform } from "@/lib/services/review-sync-range-query";
import { getSyncReviewDateRangeFormatted } from "@/lib/utils/review-date-range";

const PLATFORMS = ["baemin", "yogiyo", "ddangyo", "coupang_eats"] as const;
type Platform = (typeof PLATFORMS)[number];
const PLATFORM_TO_SYNC_TYPE = {
  baemin: "baemin_sync" as const,
  yogiyo: "yogiyo_sync" as const,
  ddangyo: "ddangyo_sync" as const,
  coupang_eats: "coupang_eats_sync" as const,
};

function isPlatform(s: string): s is Platform {
  return PLATFORMS.includes(s as Platform);
}

/**
 * 개발 환경 전용.
 * 해당 매장의 연동 플랫폼에 대해 sync job(trigger=cron) 생성.
 * 워커가 sync 결과를 반영할 때 auto_register_post_sync를 후속 생성하므로,
 * 신규 리뷰 수집→AI 초안→등록까지 실제 자동 플로우를 테스트할 수 있다.
 * POST body: { storeId: string } — userId는 stores에서 조회, 플랫폼은 store_platform_sessions에서 조회.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 404 });
  }

  let body: { storeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Required: storeId" },
      { status: 400 }
    );
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  if (!storeId) {
    return NextResponse.json({ error: "storeId is required" }, { status: 400 });
  }

  const supabase = createServiceRoleClient();
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, user_id")
    .eq("id", storeId)
    .maybeSingle();

  if (storeError || !store?.user_id) {
    return NextResponse.json(
      { error: "Store not found or has no user_id" },
      { status: 404 }
    );
  }

  const userId = store.user_id as string;
  const { data: sessions, error: sessionsError } = await supabase
    .from("store_platform_sessions")
    .select("platform")
    .eq("store_id", storeId);

  if (sessionsError) {
    console.error("[dev/trigger-auto-register-jobs] sessions", sessionsError);
    return NextResponse.json(
      { error: "Failed to list linked platforms" },
      { status: 500 }
    );
  }

  const platforms = (sessions ?? [])
    .map((r) => (r.platform as string)?.toLowerCase())
    .filter(isPlatform);

  if (platforms.length === 0) {
    return NextResponse.json({
      ok: true,
      message: "No linked platforms for this store. Nothing to do.",
      platforms: [],
    });
  }

  try {
    const jobIds: string[] = [];
    for (const platform of platforms) {
      const syncType = PLATFORM_TO_SYNC_TYPE[platform];
      const hasExisting = await storeHasReviewsForPlatform(supabase, storeId, platform);
      const syncPayload =
        platform === "baemin"
          ? (() => {
              const { from, to } = getSyncReviewDateRangeFormatted(hasExisting);
              return { from, to, offset: "0", limit: "10", fetchAll: true };
            })()
          : {};
      const jobId = await createBrowserJobWithServiceRole(
        syncType,
        storeId,
        userId,
        {
          ...syncPayload,
          trigger: "cron",
        },
      );
      jobIds.push(jobId);
    }
    return NextResponse.json({
      ok: true,
      message:
        "created *_sync(trigger=cron) jobs. Worker will run sync first, then auto_register_post_sync and register_reply as needed.",
      platforms,
      jobIds,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dev/trigger-auto-register-jobs]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
