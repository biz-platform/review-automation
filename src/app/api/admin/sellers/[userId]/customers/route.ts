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
import type { AdminSellerCustomerListData } from "@/entities/admin/types";

const getQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

/** GET: 특정 셀러(영업자) 하위 고객 (referred_by_user_id) */
async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<
  NextResponse<AppRouteHandlerResponse<AdminSellerCustomerListData>>
> {
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

  const { searchParams } = request.nextUrl;
  const q = getQuerySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
  });

  const { data: rows, error, count } = await supabase
    .from("users")
    .select("id, email, phone, role, created_at, paid_at, paid_until", {
      count: "exact",
    })
    .eq("referred_by_user_id", sellerId)
    .order("created_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);

  if (error) {
    console.error("[admin/sellers/customers] list error", error);
    throw error;
  }

  const list = (rows ?? []).map(
    (r: {
      id: string;
      email: string | null;
      phone: string | null;
      role: string;
      created_at: string;
      paid_at: string | null;
      paid_until: string | null;
    }) => ({
      id: r.id,
      email: r.email,
      phone: r.phone,
      serviceJoinedAt: r.created_at,
      lastPaidAt: r.paid_at,
      role: (r.role === "center_manager" || r.role === "planner"
        ? r.role
        : "member") as "member" | "center_manager" | "planner",
      paid_until: r.paid_until,
      paymentCount: 0,
      estimatedSettlementAmount: 0,
    }),
  );

  return NextResponse.json({
    result: { list, count: count ?? 0 },
  });
}

export const GET = withRouteHandler(getHandler);
