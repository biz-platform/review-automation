import { NextRequest, NextResponse } from "next/server";
import * as CoupangEatsSession from "@/lib/services/coupang-eats/coupang-eats-session-service";
import { baeminSessionCookiesSchema } from "@/lib/types/dto/baemin-session-dto";
import type {
  ApiResponse,
  AppRouteHandlerResponse,
} from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import {
  getStoreIdFromContext,
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";

/** GET: 쿠팡이츠 연동 세션 메타 조회 */
async function getHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const meta = await CoupangEatsSession.getCoupangEatsSessionMeta(
    storeId,
    user.id,
  );
  return NextResponse.json<AppRouteHandlerResponse<typeof meta>>({
    result: meta,
  });
}

/** POST: 쿠팡이츠 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const body = await request.json();
  const dto = baeminSessionCookiesSchema.parse(body);
  const result = await CoupangEatsSession.saveCoupangEatsSession(
    storeId,
    user.id,
    dto.cookies,
    {
      externalShopId: dto.external_shop_id,
    },
  );
  return NextResponse.json<ApiResponse<typeof result>>(
    { result },
    { status: 201 },
  );
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
