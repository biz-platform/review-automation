import { NextRequest, NextResponse } from "next/server";
import * as DdangyoSession from "@/lib/services/ddangyo/ddangyo-session-service";
import { baeminSessionCookiesSchema } from "@/lib/types/dto/baemin-session-dto";
import type {
  ApiResponse,
  AppRouteHandlerResponse,
} from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  getStoreIdFromContext,
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";

/** GET: 땡겨요 연동 세션 메타 조회 */
async function getHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const meta = await DdangyoSession.getDdangyoSessionMeta(storeId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof meta>>({
    result: meta,
  });
}

/** POST: 땡겨요 쿠키·patsto_no 수동 등록 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = baeminSessionCookiesSchema.parse(body);
  const result = await DdangyoSession.saveDdangyoSession(
    storeId,
    user.id,
    dto.cookies,
    { externalShopId: dto.external_shop_id },
  );
  return NextResponse.json<ApiResponse<typeof result>>(
    { result },
    { status: 201 },
  );
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
