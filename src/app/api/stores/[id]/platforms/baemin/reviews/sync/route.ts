import { NextRequest, NextResponse } from "next/server";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getReviewSyncWindowDateRangeFormatted } from "@/lib/utils/review-date-range";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** POST: 리뷰 수집 작업 생성. 로컬 워커가 처리 후 DB 반영. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  /** 매장 연동(post_link) 이외의 수동 sync는 최근 1개월(ongoing)만. */
  const syncWindow = "ongoing" as const;
  const { from, to } = getReviewSyncWindowDateRangeFormatted(syncWindow);

  const jobId = await createBrowserJob("baemin_sync", storeId, user.id, {
    from,
    to,
    offset: "0",
    limit: "10",
    fetchAll: true,
    syncWindow,
    /** 수동 동기화만 — AI 초안·자동 답글 파이프라인은 `trigger: cron`(예약) 경로에서만 */
    trigger: "manual" as const,
  });

  return NextResponse.json({ result: { jobId } }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
