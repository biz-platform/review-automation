import { NextRequest, NextResponse } from "next/server";
import { claimNextBrowserJobBatch } from "@/lib/services/browser-job-service";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

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

/** GET: 워커가 같은 (store_id, type, user_id) pending 작업을 배치로 선점. 0건이면 204, 있으면 { jobs } */
async function getHandler(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = request.nextUrl.searchParams.get("workerId") ?? "local-1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit =
    limitParam != null ? Math.min(100, Math.max(1, Number(limitParam) || 20)) : 20;

  const jobs = await claimNextBrowserJobBatch(workerId, limit);

  if (jobs.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ jobs });
}

export const GET = withRouteHandler(getHandler);
