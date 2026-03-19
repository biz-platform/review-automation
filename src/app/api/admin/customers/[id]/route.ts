import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

const patchBodySchema = z.object({
  role: z.enum(["center_manager", "planner", "member"]),
});

type PatchResult = { id: string; role: string; is_seller: boolean };

/** PATCH: 어드민에서 고객 회원 유형 변경. 센터장으로 변경 시에만 is_seller=true, 플래너/멤버는 is_seller=false */
async function patchHandler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<PatchResult>>> {
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
  const id = (resolved as { id?: string }).id;
  if (!id) {
    throw new AppBadRequestError({
      code: "MISSING_ID",
      message: "고객 ID가 필요합니다.",
      detail: "id required",
    });
  }

  const body = await _request.json();
  const { role } = patchBodySchema.parse(body);

  const isSeller = role === "center_manager";

  const { data: updated, error } = await supabase
    .from("users")
    .update({ role, is_seller: isSeller })
    .eq("id", id)
    .select("id, role, is_seller")
    .single();

  if (error || !updated) {
    if (error?.code === "PGRST116") {
      throw new AppNotFoundError({
        code: "CUSTOMER_NOT_FOUND",
        message: "고객을 찾을 수 없습니다.",
        detail: id,
      });
    }
    throw error ?? new Error("Update failed");
  }

  return NextResponse.json({
    result: {
      id: updated.id,
      role: updated.role as string,
      is_seller: Boolean(updated.is_seller),
    },
  });
}

export const PATCH = withRouteHandler(patchHandler);
