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
  referredByUserId: z.string().uuid().nullable(),
});

type PatchResult = {
  id: string;
  referred_by_user_id: string | null;
  referred_by_email: string | null;
  referred_by_role: "center_manager" | "planner" | null;
};

/** PATCH: 어드민 — 고객의 셀러 연결(referred_by_user_id) 설정·해제 (일반 회원만 지정) */
async function patchHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<PatchResult>>> {
  const { user } = await getUser(request);
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
  const customerId = (resolved as { id?: string }).id;
  if (!customerId) {
    throw new AppBadRequestError({
      code: "MISSING_ID",
      message: "고객 ID가 필요합니다.",
      detail: "id required",
    });
  }

  const body = await request.json();
  const { referredByUserId } = patchBodySchema.parse(body);

  const { data: customer, error: custErr } = await supabase
    .from("users")
    .select("id, role")
    .eq("id", customerId)
    .maybeSingle();

  if (custErr || !customer) {
    throw new AppNotFoundError({
      code: "CUSTOMER_NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
      detail: customerId,
    });
  }

  if (referredByUserId !== null) {
    if (customer.role !== "member") {
      throw new AppBadRequestError({
        code: "REFERRAL_MEMBER_ONLY",
        message: "일반 회원만 셀러 연결을 지정할 수 있습니다.",
      });
    }
    if (referredByUserId === customerId) {
      throw new AppBadRequestError({
        code: "REFERRAL_SELF",
        message: "본인을 셀러로 지정할 수 없습니다.",
      });
    }

    const { data: seller, error: selErr } = await supabase
      .from("users")
      .select("id, email, role, is_seller")
      .eq("id", referredByUserId)
      .maybeSingle();

    if (selErr || !seller) {
      throw new AppBadRequestError({
        code: "REFERRAL_SELLER_NOT_FOUND",
        message: "셀러를 찾을 수 없습니다.",
      });
    }

    if (!seller.is_seller || (seller.role !== "center_manager" && seller.role !== "planner")) {
      throw new AppBadRequestError({
        code: "REFERRAL_SELLER_INVALID",
        message: "셀러 등록이 완료된 센터장·플래너만 연결할 수 있습니다.",
      });
    }
  }

  const { error: updErr } = await supabase
    .from("users")
    .update({ referred_by_user_id: referredByUserId })
    .eq("id", customerId);

  if (updErr) {
    console.error("[admin/customers/referral] update", updErr);
    throw updErr;
  }

  const { data: after } = await supabase
    .from("users")
    .select("id, referred_by_user_id")
    .eq("id", customerId)
    .maybeSingle();

  if (!after) {
    throw new AppNotFoundError({
      code: "CUSTOMER_NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
      detail: customerId,
    });
  }

  let referred_by_email: string | null = null;
  let referred_by_role: "center_manager" | "planner" | null = null;

  if (after.referred_by_user_id) {
    const { data: refUser } = await supabase
      .from("users")
      .select("email, role")
      .eq("id", after.referred_by_user_id)
      .maybeSingle();
    referred_by_email = refUser?.email ?? null;
    const rr = refUser?.role;
    if (rr === "center_manager" || rr === "planner") {
      referred_by_role = rr;
    }
  }

  return NextResponse.json({
    result: {
      id: after.id,
      referred_by_user_id: after.referred_by_user_id,
      referred_by_email,
      referred_by_role,
    },
  });
}

export const PATCH = withRouteHandler(patchHandler);
