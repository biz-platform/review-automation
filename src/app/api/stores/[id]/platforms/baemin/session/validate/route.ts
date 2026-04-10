import { NextRequest, NextResponse } from "next/server";
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

/** GET: 저장된 배민 세션이 아직 유효한지 확인 (self.baemin.com 요청으로 검사) */
async function getHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const valid = await BaeminSession.isBaeminSessionValid(storeId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<{ valid: boolean }>>({
    result: { valid },
  });
}

export const GET = withRouteHandler(getHandler);
