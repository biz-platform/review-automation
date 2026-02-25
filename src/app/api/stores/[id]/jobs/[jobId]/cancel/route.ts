import { NextRequest, NextResponse } from "next/server";
import {
  getBrowserJob,
  cancelBrowserJob,
} from "@/lib/services/browser-job-service";
import {
  getStoreIdFromContext,
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";

/** POST: 작업 취소. 본인 매장 job만 취소 가능. pending/processing만 취소 가능 */
async function postHandler(_request: NextRequest, context?: RouteContext) {
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
  if (job.status !== "pending" && job.status !== "processing") {
    return NextResponse.json(
      { error: "Job cannot be cancelled", status: job.status },
      { status: 409 }
    );
  }

  const updated = await cancelBrowserJob(jobId);
  return NextResponse.json({ ok: updated });
}

export const POST = withRouteHandler(postHandler);
