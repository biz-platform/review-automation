import { NextRequest, NextResponse } from "next/server";
import * as BaeminSession from "@/lib/services/baemin-session-service";
import { baeminSessionCookiesSchema } from "@/lib/types/dto/baemin-session-dto";
import type { ApiResponse, AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

/** GET: 배민 연동 세션 메타 조회 (쿠키 값 제외) */
async function getHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id: storeId } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const meta = await BaeminSession.getBaeminSessionMeta(storeId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof meta>>({
    result: meta,
  });
}

/**
 * POST: 배민 셀프서비스 로그인 쿠키 등록(연동).
 * 브라우저에서 self.baemin.com / biz-member.baemin.com 로그인 후 개발자도구 → Application → Cookies 에서
 * bm_session_id, cookie30d, dsid 등 필요한 쿠키를 { name, value, domain, path } 배열로 복사해 body에 전달.
 */
async function postHandler(
  request: NextRequest,
  context: { params?: Promise<{ id: string }> }
) {
  const { id: storeId } = await (context.params ?? Promise.resolve({ id: "" }));
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = baeminSessionCookiesSchema.parse(body);
  const result = await BaeminSession.saveBaeminSession(storeId, user.id, dto.cookies, {
    externalShopId: dto.external_shop_id,
    shopOwnerNumber: dto.shop_owner_number,
  });
  return NextResponse.json<ApiResponse<typeof result>>({ result }, { status: 201 });
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
