import { NextRequest, NextResponse } from "next/server";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import type { DashboardReviewAnalysisData } from "@/entities/dashboard/reviews-types";
import { buildDashboardReviewAnalysisData } from "@/lib/dashboard/build-dashboard-review-analysis";

async function getHandler(
  request: NextRequest,
): Promise<
  NextResponse<AppRouteHandlerResponse<DashboardReviewAnalysisData>>
> {
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);

  const { searchParams } = request.nextUrl;
  const storeIdRaw = (searchParams.get("storeId") ?? "").trim();
  const rangeRaw = (searchParams.get("range") ?? "30d") as "7d" | "30d";
  const platformParam = (searchParams.get("platform") ?? "").trim();

  if (!storeIdRaw) {
    throw new AppBadRequestError({
      code: "STORE_ID_REQUIRED",
      message: "storeId가 필요합니다. (단일 매장 id 또는 all)",
    });
  }

  if (rangeRaw !== "7d" && rangeRaw !== "30d") {
    throw new AppBadRequestError({
      code: "INVALID_RANGE",
      message: "range는 7d 또는 30d 여야 합니다.",
    });
  }

  const result = await buildDashboardReviewAnalysisData(supabase, {
    ownerUserId: user.id,
    storeIdRaw,
    platformParam,
    range: rangeRaw,
  });

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
