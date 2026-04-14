import { NextRequest, NextResponse } from "next/server";
import {
  getBrowserJobById,
  updateBrowserJobProgress,
} from "@/lib/services/browser-job-service";
import { isWorkerRequestAuthorized } from "@/lib/config/server-env-readers";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** GET: 워커 전용 job 상태 조회. 취소 여부 확인용 */
async function getHandler(request: NextRequest, context?: RouteContext) {
  if (!isWorkerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await (context?.params ?? Promise.resolve({}));
  const jobId = (params as { id?: string }).id ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "job id required" }, { status: 400 });
  }

  const job = await getBrowserJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    type: job.type,
  });
}

export const GET = withRouteHandler(getHandler);

/** PATCH: 워커 진행률(result_summary) 중간 업데이트 */
async function patchHandler(request: NextRequest, context?: RouteContext) {
  if (!isWorkerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await (context?.params ?? Promise.resolve({}));
  const jobId = (params as { id?: string }).id ?? "";
  if (!jobId) {
    return NextResponse.json({ error: "job id required" }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    result_summary?: Record<string, unknown>;
  };
  if (
    body.result_summary == null ||
    typeof body.result_summary !== "object" ||
    Array.isArray(body.result_summary)
  ) {
    return NextResponse.json(
      { error: "result_summary object required" },
      { status: 400 },
    );
  }

  await updateBrowserJobProgress(jobId, body.result_summary);
  return NextResponse.json({ ok: true });
}

export const PATCH = withRouteHandler(patchHandler);
