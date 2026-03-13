import { NextRequest, NextResponse } from "next/server";
import { getBrowserJobByJobIdForUser } from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** GET: jobId로 작업 상태 조회 (store_id 없는 첫 연동 폴링용). RLS로 본인 job만 반환 */
async function getHandler(_request: NextRequest, context?: RouteContext) {
  const params = await (context?.params ?? Promise.resolve({}));
  const jobId = (params as { jobId?: string }).jobId ?? "";

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await getBrowserJobByJobIdForUser(jobId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const result = {
    id: job.id,
    type: job.type,
    status: job.status,
    store_id: job.store_id ?? undefined,
    result: job.result ?? undefined,
    error_message: job.error_message ?? undefined,
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const GET = withRouteHandler(getHandler);
