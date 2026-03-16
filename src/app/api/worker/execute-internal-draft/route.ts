import { NextRequest, NextResponse } from "next/server";
import { getBrowserJobById } from "@/lib/services/browser-job-service";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";
import { generateDraftContentWithServiceRole } from "@/lib/services/ai-draft-service";

const WORKER_SECRET = process.env.WORKER_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET?.length) return false;
  const header =
    request.headers.get("x-worker-secret") ??
    request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === WORKER_SECRET;
  }
  return header === WORKER_SECRET;
}

const PLATFORM_TO_REGISTER_REPLY_TYPE = {
  baemin: "baemin_register_reply" as const,
  yogiyo: "yogiyo_register_reply" as const,
  ddangyo: "ddangyo_register_reply" as const,
  coupang_eats: "coupang_eats_register_reply" as const,
};

/**
 * 워커 전용: internal_auto_register_draft job 실행.
 * AI 초안 생성 후 register_reply job 1건 생성. POST body: { jobId }.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { jobId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, errorMessage: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const jobId = body.jobId;
  if (typeof jobId !== "string" || !jobId.trim()) {
    return NextResponse.json(
      { success: false, errorMessage: "jobId required" },
      { status: 400 }
    );
  }

  const job = await getBrowserJobById(jobId.trim());
  if (!job) {
    return NextResponse.json(
      { success: false, errorMessage: "Job not found" },
      { status: 404 }
    );
  }

  if (job.type !== "internal_auto_register_draft") {
    return NextResponse.json(
      { success: false, errorMessage: "Invalid job type" },
      { status: 400 }
    );
  }

  const p = job.payload;
  const reviewId = (p?.reviewId ?? p?.review_id) as string | undefined;
  const storeId = (p?.storeId ?? p?.store_id) as string | undefined;
  const platform = p?.platform as string | undefined;
  const userId = (p?.userId ?? p?.user_id) as string | undefined;
  const externalId = p?.external_id as string | undefined;
  const writtenAt = p?.written_at as string | undefined;

  if (
    !reviewId ||
    !storeId ||
    !userId ||
    !externalId?.trim() ||
    !platform
  ) {
    return NextResponse.json(
      {
        success: false,
        errorMessage: "payload missing reviewId, storeId, platform, userId, or external_id",
      },
      { status: 400 }
    );
  }

  const registerReplyType =
    PLATFORM_TO_REGISTER_REPLY_TYPE[
      platform as keyof typeof PLATFORM_TO_REGISTER_REPLY_TYPE
    ];
  if (!registerReplyType) {
    return NextResponse.json(
      { success: false, errorMessage: "Unsupported platform" },
      { status: 400 }
    );
  }

  try {
    const content = await generateDraftContentWithServiceRole(reviewId);
    await createBrowserJobWithServiceRole(
      registerReplyType,
      storeId,
      userId,
      {
        reviewId,
        external_id: externalId,
        content,
        written_at: writtenAt,
      }
    );
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[execute-internal-draft]", jobId, message, e);
    return NextResponse.json(
      { success: false, errorMessage: message },
      { status: 500 }
    );
  }
}
