import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/utils/auth/get-user";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";

const getSellerCustomersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  email: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || v === "" ? "" : String(v).trim())),
});

export type SellerCustomerItem = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  /** 향후 결제 테이블 연동 시 사용 */
  cumulative_payment_amount: number;
  last_payment_at: string | null;
};

/** GET: 셀러 본인 하위 고객 목록 (referred_by_user_id = 현재 유저). is_seller만 허용. */
async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<{ list: SellerCustomerItem[]; count: number }>>> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_seller")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_seller) {
    throw new AppForbiddenError({
      code: "SELLER_REQUIRED",
      message: "셀러 권한이 필요합니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const queryDto = getSellerCustomersQuerySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    email: searchParams.get("email"),
  });
  const { limit, offset, email: emailQ } = queryDto;

  let query = supabase
    .from("users")
    .select("id, email, phone, created_at", { count: "exact" })
    .eq("referred_by_user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (emailQ) {
    query = query.ilike("email", `%${emailQ}%`);
  }

  const { data: rows, error, count } = await query;

  if (error) {
    console.error("[sellers/customers] list error", error);
    throw error;
  }

  const list: SellerCustomerItem[] = (rows ?? []).map((r: { id: string; email: string | null; phone: string | null; created_at: string }) => ({
    id: r.id,
    email: r.email ?? null,
    phone: r.phone ?? null,
    created_at: r.created_at,
    cumulative_payment_amount: 0,
    last_payment_at: null,
  }));

  return NextResponse.json({
    result: { list, count: count ?? 0 },
  });
}

export const GET = withRouteHandler(getHandler);
