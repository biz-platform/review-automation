import { NextRequest, NextResponse } from "next/server";
import { isWorkerRequestAuthorized } from "@/lib/config/server-env-readers";
import {
  claimNextBrowserJobBatch,
  type WorkerJobFamily,
} from "@/lib/services/browser-job-service";
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

/** GET: 워커가 같은 (store_id, type, user_id) pending 작업을 배치로 선점. 0건이면 204, 있으면 { jobs } */
async function getHandler(request: NextRequest) {
  if (!isWorkerRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workerId = request.nextUrl.searchParams.get("workerId") ?? "local-1";
  const platform = request.nextUrl.searchParams.get("platform");
  const jobFamilyRaw = request.nextUrl.searchParams.get("jobFamily");
  let jobFamily: WorkerJobFamily | null = null;
  if (jobFamilyRaw != null && jobFamilyRaw !== "") {
    if (jobFamilyRaw !== "orders" && jobFamilyRaw !== "reviews") {
      return NextResponse.json(
        { error: "Invalid jobFamily", allowed: ["orders", "reviews"] },
        { status: 400 },
      );
    }
    jobFamily = jobFamilyRaw;
  }
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit =
    limitParam != null ? Math.min(100, Math.max(1, Number(limitParam) || 20)) : 20;

  let jobs: Awaited<ReturnType<typeof claimNextBrowserJobBatch>>;
  try {
    jobs = await claimNextBrowserJobBatch(workerId, limit, platform, jobFamily);
  } catch (e) {
    // 워커가 재시도/backoff 할 수 있게 503로 내린다 (Supabase 네트워크/일시 장애 등).
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

  if (jobs.length === 0) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ jobs });
}

export const GET = withRouteHandler(getHandler);
