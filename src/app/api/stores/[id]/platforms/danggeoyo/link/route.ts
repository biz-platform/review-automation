import { NextRequest, NextResponse } from "next/server";
import * as DdangyoSession from "@/lib/services/ddangyo/ddangyo-session-service";
import { loginDdangyoAndGetCookies } from "@/lib/services/ddangyo/ddangyo-login-service";
import type { ApiResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  getStoreIdFromContext,
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import { z } from "zod";

const linkBodySchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

/** POST: 아이디/비밀번호로 땡겨요 로그인 후 세션(쿠키·patsto_no) 저장 */
async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const body = await request.json();
  const { username, password } = linkBodySchema.parse(body);

  try {
    const { cookies, external_shop_id } = await loginDdangyoAndGetCookies(
      username,
      password,
    );
    const result = await DdangyoSession.saveDdangyoSession(
      storeId,
      user.id,
      cookies,
      { externalShopId: external_shop_id },
    );
    return NextResponse.json<ApiResponse<typeof result>>(
      { result },
      { status: 201 },
    );
  } catch (e) {
    console.error("[ddangyo-link] 연동 중 예외:", e);
    throw e;
  }
}

export const POST = withRouteHandler(postHandler);
