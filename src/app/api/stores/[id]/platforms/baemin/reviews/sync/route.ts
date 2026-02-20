import { NextRequest, NextResponse } from "next/server";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import { getUser } from "@/lib/utils/auth/get-user";
import { getDefaultReviewDateRangeFormatted } from "@/lib/utils/review-date-range";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** POST: 리뷰 수집 작업 생성. 로컬 워커가 처리 후 DB 반영. 202 + jobId 반환 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const { from, to } = getDefaultReviewDateRangeFormatted();

  const jobId = await createBrowserJob("baemin_sync", storeId, user.id, {
    from,
    to,
    offset: "0",
    limit: "10",
    fetchAll: true,
  });

  return NextResponse.json({ jobId }, { status: 202 });
}

export const POST = withRouteHandler(postHandler);
