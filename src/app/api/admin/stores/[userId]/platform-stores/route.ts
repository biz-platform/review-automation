import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";
import type { AdminUserPlatformStoresData } from "@/entities/admin/types";
import { StoreService } from "@/lib/services/store-service";

const storeService = new StoreService();

/** GET: 특정 고객의 플랫폼별 연동 매장 목록 (대시보드 셀렉트용, /api/stores?linked_platform 과 동형) */
async function getHandler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<
  NextResponse<AppRouteHandlerResponse<AdminUserPlatformStoresData>>
> {
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
  const targetUserId = (resolved as { userId?: string }).userId;
  if (!targetUserId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();

  if (!userRow) {
    throw new AppNotFoundError({
      code: "USER_NOT_FOUND",
      message: "해당 고객을 찾을 수 없습니다.",
    });
  }

  const [
    storesBaemin,
    storesCoupangEats,
    storesYogiyo,
    storesDdangyo,
  ] = await Promise.all([
    storeService.findAllByLinkedPlatformWithSession(
      targetUserId,
      "baemin",
      supabase,
    ),
    storeService.findAllByLinkedPlatformWithSession(
      targetUserId,
      "coupang_eats",
      supabase,
    ),
    storeService.findAllByLinkedPlatformWithSession(
      targetUserId,
      "yogiyo",
      supabase,
    ),
    storeService.findAllByLinkedPlatformWithSession(
      targetUserId,
      "ddangyo",
      supabase,
    ),
  ]);

  return NextResponse.json({
    result: {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    },
  });
}

export const GET = withRouteHandler(getHandler);
