import { NextRequest, NextResponse } from "next/server";
import { claimNextBrowserJob } from "@/lib/services/browser-job-service";

const WORKER_SECRET = process.env.WORKER_SECRET;

function isAuthorized(request: NextRequest): boolean {
  if (!WORKER_SECRET?.length) return false;
  const header = request.headers.get("x-worker-secret") ?? request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim() === WORKER_SECRET;
  }
  return header === WORKER_SECRET;
}

/** GET: 워커가 pending 작업 1건 선점. x-worker-secret 또는 Authorization: Bearer <WORKER_SECRET> */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = request.nextUrl.searchParams.get("workerId") ?? "local-1";
  const job = await claimNextBrowserJob(workerId);

  if (!job) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({
    id: job.id,
    type: job.type,
    store_id: job.store_id,
    user_id: job.user_id,
    payload: job.payload,
  });
}
