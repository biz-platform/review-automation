import { NextRequest, NextResponse } from "next/server";
import { getRecentBrowserJobsForUser } from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

type JobSummary = { id: string; type: string; status: string; updated_at: string };

/** GET: 최근 job 목록 (RLS로 본인 job만). 완료 시 review 갱신용 폴링 */
async function getHandler(request: NextRequest) {
  const limit = Math.min(
    Math.max(1, Number(request.nextUrl.searchParams.get("limit")) || 30),
    50,
  );
  const jobs = await getRecentBrowserJobsForUser(limit);
  return NextResponse.json<AppRouteHandlerResponse<JobSummary[]>>({ result: jobs });
}

export const GET = withRouteHandler(getHandler);
