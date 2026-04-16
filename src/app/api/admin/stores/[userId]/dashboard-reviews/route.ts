import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import {
  AppBadRequestError,
  AppForbiddenError,
  AppNotFoundError,
} from "@/lib/errors/app-error";
import { parseAdminDashboardRangeParam } from "@/entities/admin/types";
import type { DashboardReviewAnalysisData } from "@/entities/dashboard/reviews-types";
import { buildDashboardReviewAnalysisData } from "@/lib/dashboard/build-dashboard-review-analysis";

async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<
  NextResponse<AppRouteHandlerResponse<DashboardReviewAnalysisData>>
> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const resolved = await (context?.params ?? Promise.resolve({}));
  const customerUserId = (resolved as { userId?: string }).userId;
  if (!customerUserId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const storeIdRaw = (searchParams.get("storeId") ?? "").trim();
  const range = parseAdminDashboardRangeParam(searchParams.get("range"));
  const platformParam = (searchParams.get("platform") ?? "").trim();

  if (!storeIdRaw) {
    throw new AppBadRequestError({
      code: "STORE_ID_REQUIRED",
      message:
        "storeId가 필요합니다. (단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id))",
    });
  }

  const result = await buildDashboardReviewAnalysisData(supabase, {
    ownerUserId: customerUserId,
    storeIdRaw,
    platformParam,
    range,
  });

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
