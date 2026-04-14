import { NextRequest, NextResponse } from "next/server";
import { isWorkerRequestAuthorized } from "@/lib/config/server-env-readers";
import { claimNextBrowserJob } from "@/lib/services/browser-job-service";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

function isSupabaseFetchFailed(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message?.toLowerCase() ?? "";
  if (msg.includes("fetch failed")) return true;
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const cmsg = cause.message?.toLowerCase() ?? "";
    return cmsg.includes("fetch failed") || cmsg.includes("und_err");
  }
  return false;
}

/** GET: 워커가 pending 작업 1건 선점. x-worker-secret 또는 Authorization: Bearer <WORKER_SECRET> */
async function getHandler(request: NextRequest) {
  if (!isWorkerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = request.nextUrl.searchParams.get("workerId") ?? "local-1";
  let job: Awaited<ReturnType<typeof claimNextBrowserJob>>;
  try {
    job = await claimNextBrowserJob(workerId);
  } catch (e) {
    if (isSupabaseFetchFailed(e)) {
      return NextResponse.json(
        {
          error: "Service Unavailable",
          code: "SUPABASE_FETCH_FAILED",
          detail:
            e instanceof Error ? e.message : "Supabase request failed (fetch failed)",
        },
        { status: 503 },
      );
    }
    throw e;
  }

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

export const GET = withRouteHandler(getHandler);
