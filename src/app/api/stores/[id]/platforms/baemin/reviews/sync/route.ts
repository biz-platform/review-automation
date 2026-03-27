import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { storeHasReviewsForPlatform } from "@/lib/services/review-sync-range-query";
import { getUser } from "@/lib/utils/auth/get-user";
import { getSyncReviewDateRangeFormatted } from "@/lib/utils/review-date-range";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** POST: 리뷰 수집 작업 생성. 로컬 워커가 처리 후 DB 반영. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  /** 요청 Cookie 폴백 — `cookies()`만 쓰면 RLS count=0 → 항상 180일 구간으로 잡히는 문제 방지 */
  const supabase = await createServerSupabaseClient(request);
  const hasExisting = await storeHasReviewsForPlatform(supabase, storeId, "baemin");
  const { from, to } = getSyncReviewDateRangeFormatted(hasExisting);

  const jobId = await createBrowserJob("baemin_sync", storeId, user.id, {
    from,
    to,
    offset: "0",
    limit: "10",
    fetchAll: true,
    /** 수동 동기화만 — AI 초안·자동 답글 파이프라인은 `trigger: cron`(예약) 경로에서만 */
    trigger: "manual" as const,
  });

  return NextResponse.json({ result: { jobId } }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
