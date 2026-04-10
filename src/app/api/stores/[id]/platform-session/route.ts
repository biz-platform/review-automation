import { NextRequest, NextResponse } from "next/server";
import { deletePlatformSession } from "@/lib/services/platform-session-service";
import { PLATFORM_CODES } from "@/lib/types/dto/platform-dto";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** DELETE: 해당 매장·플랫폼 연동 해제 (store_platform_sessions 행 삭제) */
async function deleteHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const platformParam = request.nextUrl.searchParams.get("platform") ?? "";
  const platform = PLATFORM_CODES.includes(platformParam as (typeof PLATFORM_CODES)[number])
    ? (platformParam as (typeof PLATFORM_CODES)[number])
    : null;
  if (!platform) {
    return NextResponse.json(
      { error: "platform 쿼리 필요 (baemin | yogiyo | ddangyo | coupang_eats)" },
      { status: 400 },
    );
  }
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  await deletePlatformSession(storeId, platform, user.id);
  return NextResponse.json({ result: { success: true } });
}

export const DELETE = withRouteHandler(deleteHandler);
