import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createRegisterReplyJobsForUnansweredAfterSync } from "@/lib/services/browser-job-apply-result";

const PLATFORMS = ["baemin", "yogiyo", "ddangyo", "coupang_eats"] as const;
type Platform = (typeof PLATFORMS)[number];

function isPlatform(s: string): s is Platform {
  return PLATFORMS.includes(s as Platform);
}

/**
 * 개발 환경 전용. 해당 매장에 연동된 모든 플랫폼에 대해 자동 등록 job 생성 (sync 없이).
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
    for (const platform of platforms) {
      await createRegisterReplyJobsForUnansweredAfterSync(storeId, platform, userId);
    }
    return NextResponse.json({
      ok: true,
      message:
        "createRegisterReplyJobsForUnansweredAfterSync completed for all linked platforms. Check browser_jobs for register_reply / internal_auto_register_draft (only 4–5 star reviews).",
      platforms,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dev/trigger-auto-register-jobs]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
