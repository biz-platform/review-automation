import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";
import type { AdminCustomerListData } from "@/entities/admin/types";

const getAdminCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  keyword: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? "" : String(v).trim())),
  memberType: z
    .enum(["all", "center_manager", "planner", "paid_member", "free_member"])
    .optional()
    .default("all"),
});

type AdminCustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "member" | "center_manager" | "planner";
  is_seller: boolean;
  paid_at: string | null;
  paid_until: string | null;
  created_at: string;
  billing_state: "exempt" | "active" | "expired" | "unpaid";
  total_count: string | number;
};

/** GET: 어드민 고객 목록 */
async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<AdminCustomerListData>>> {
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

  const { searchParams } = request.nextUrl;
  const query = getAdminCustomersQuerySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    keyword: searchParams.get("keyword") ?? undefined,
    memberType: searchParams.get("memberType") ?? undefined,
  });

  const { data, error } = await supabase.rpc("admin_list_customers", {
    p_limit: query.limit,
    p_offset: query.offset,
    p_keyword: query.keyword,
    p_member_type: query.memberType,
  });

  if (error) {
    console.error("[admin/customers] list error", error);
    throw error;
  }

  const rows = (data ?? []) as AdminCustomerRow[];
  const count = rows[0]?.total_count != null ? Number(rows[0].total_count) : 0;

  const list: AdminCustomerListData["list"] = rows.map((row) => ({
    id: row.id,
    email: row.email,
    phone: row.phone,
    role: row.role,
    is_seller: row.is_seller === true,
    paid_at: row.paid_at,
    paid_until: row.paid_until,
    created_at: row.created_at,
    billing_state: row.billing_state,
  }));

  return NextResponse.json({
    result: { list, count },
  });
}

export const GET = withRouteHandler(getHandler);
