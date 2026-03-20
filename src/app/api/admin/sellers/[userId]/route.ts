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

/** DELETE: 셀러 삭제(일반 회원 전환, 하위 고객 referred_by 해제, 디비톡·추천 코드 연결 제거) */
async function deleteHandler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<{ success: true }>>> {
  const { user } = await getUser(_request);
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
  const sellerId = (resolved as { userId?: string }).userId ?? "";
  if (!sellerId) {
    throw new AppBadRequestError({
      code: "MISSING_ID",
      message: "셀러 ID가 필요합니다.",
      detail: "userId required",
    });
  }

  const { data: seller } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", sellerId)
    .maybeSingle();

  if (!seller) {
    throw new AppNotFoundError({
      code: "SELLER_NOT_FOUND",
      message: "셀러를 찾을 수 없습니다.",
      detail: sellerId,
    });
  }

  const role = seller.role as string;
  if (role !== "center_manager" && role !== "planner") {
    throw new AppBadRequestError({
      code: "NOT_A_SELLER_ROLE",
      message: "해당 회원은 셀러 유형이 아닙니다.",
      detail: role,
    });
  }

  const { error: clearRefErr } = await supabase
    .from("users")
    .update({ referred_by_user_id: null })
    .eq("referred_by_user_id", sellerId);

  if (clearRefErr) {
    console.error("[admin/sellers] clear referred_by error", clearRefErr);
    throw clearRefErr;
  }

  const { error: updErr } = await supabase
    .from("users")
    .update({
      role: "member",
      is_seller: false,
      dbtalk_partner_id: null,
      dbtalk_verified_at: null,
      referral_code: null,
    })
    .eq("id", sellerId);

  if (updErr) {
    console.error("[admin/sellers] demote seller error", updErr);
    throw updErr;
  }

  return NextResponse.json({ result: { success: true as const } });
}

export const DELETE = withRouteHandler(deleteHandler);
