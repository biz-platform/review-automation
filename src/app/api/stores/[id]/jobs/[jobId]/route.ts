import { NextRequest, NextResponse } from "next/server";
import { getBrowserJob } from "@/lib/services/browser-job-service";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** GET: 작업 상태 조회 (폴링용). 본인 매장 job만 RLS로 조회 */
async function getHandler(_request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const params = await (context?.params ?? Promise.resolve({}));
  const jobId = (params as { jobId?: string }).jobId ?? "";

  if (!jobId) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await getBrowserJob(jobId, storeId);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    type: job.type,
    status: job.status,
    result: job.result ?? undefined,
    error_message: job.error_message ?? undefined,
    created_at: job.created_at,
    updated_at: job.updated_at,
  });
}

export const GET = withRouteHandler(getHandler);
