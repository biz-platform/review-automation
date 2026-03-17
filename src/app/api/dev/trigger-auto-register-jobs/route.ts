import { NextRequest, NextResponse } from "next/server";
import { createRegisterReplyJobsForUnansweredAfterSync } from "@/lib/services/browser-job-apply-result";

const PLATFORMS = ["baemin", "yogiyo", "ddangyo", "coupang_eats"] as const;

/**
 * 개발 환경 전용. 자동 등록 job 생성 로직만 단독 실행 (sync 없이).
 * 별점 3점 이하 제외 동작 검증용.
 * POST body: { storeId: string, platform: "baemin"|"yogiyo"|"ddangyo"|"coupang_eats", userId: string }
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Only available in development" }, { status: 404 });
  }

  let body: { storeId?: string; platform?: string; userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Required: storeId, platform, userId" },
      { status: 400 }
    );
  }

  const storeId = typeof body.storeId === "string" ? body.storeId.trim() : "";
  const platform = body.platform as (typeof PLATFORMS)[number] | undefined;
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!storeId || !userId) {
    return NextResponse.json(
      { error: "storeId and userId are required" },
      { status: 400 }
    );
  }
  if (!platform || !PLATFORMS.includes(platform)) {
    return NextResponse.json(
      { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await createRegisterReplyJobsForUnansweredAfterSync(storeId, platform, userId);
    return NextResponse.json({
      ok: true,
      message:
        "createRegisterReplyJobsForUnansweredAfterSync completed. Check browser_jobs for register_reply / internal_auto_register_draft (only 4–5 star reviews).",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[dev/trigger-auto-register-jobs]", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
