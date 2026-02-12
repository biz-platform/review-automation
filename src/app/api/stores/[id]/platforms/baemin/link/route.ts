import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as BaeminSession from "@/lib/services/baemin-session-service";
import { loginBaeminAndGetCookies } from "@/lib/services/baemin-login-service";
import type { ApiResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const DEBUG = process.env.DEBUG_BAEMIN_LINK === "1";
const log = (...args: unknown[]) => (DEBUG ? console.log("[baemin-link]", ...args) : undefined);

const linkBodySchema = z.object({
  username: z.string().min(1, "아이디를 입력해 주세요"),
  password: z.string().min(1, "비밀번호를 입력해 주세요"),
});

/** POST: 아이디/비밀번호로 배민 셀프서비스 로그인 후 세션 저장 */
async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const storeId = params.id ?? "";
  const { user } = await getUser(request);
  const body = await request.json();
  const { username, password } = linkBodySchema.parse(body);

  try {
    log("로그인 시도 storeId =", storeId);
    const { cookies, baeminShopId, shopOwnerNumber } = await loginBaeminAndGetCookies(username, password);
    log("로그인 결과 → saveBaeminSession 옵션:", {
      externalShopId: baeminShopId,
      shopOwnerNumber,
      cookiesCount: cookies.length,
    });

    const result = await BaeminSession.saveBaeminSession(storeId, user.id, cookies, {
      externalShopId: baeminShopId,
      shopOwnerNumber,
    });
    log("저장 결과:", {
      external_shop_id: result.external_shop_id,
      shop_owner_number: result.shop_owner_number,
    });

    return NextResponse.json<ApiResponse<typeof result>>({ result }, { status: 201 });
  } catch (e) {
    console.error("[baemin-link] 연동 중 예외:", e);
    throw e;
  }
}

export const POST = withRouteHandler(postHandler);
