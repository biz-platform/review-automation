import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";

export type SettlementSummary = {
  paymentCount: number;
  estimatedSettlementAmount: number;
};

export type SettlementItem = {
  id: string;
  email: string | null;
  phone: string | null;
  payment_amount: number;
  settlement_amount: number;
  payment_at: string;
};

/** GET: 셀러 정산 요약 + 목록. is_seller만 허용. (결제 테이블 연동 전까지 빈 데이터 반환) */
async function getHandler(
  request: NextRequest,
): Promise<
  NextResponse<
    AppRouteHandlerResponse<{
      summary: SettlementSummary;
      list: SettlementItem[];
      count: number;
    }>
  >
> {
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
  const _emailOrPhone = searchParams.get("emailOrPhone")?.trim() ?? "";
  const _yearMonth = searchParams.get("yearMonth")?.trim() ?? "";
  const limit = Math.min(Math.max(1, Number(searchParams.get("limit")) || 20), 100);
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

  // TODO: 결제/정산 테이블 연동 시 summary·list 조회
  const summary: SettlementSummary = {
    paymentCount: 0,
    estimatedSettlementAmount: 0,
  };
  const list: SettlementItem[] = [];
  const count = 0;

  return NextResponse.json({
    result: { summary, list, count },
  });
}

export const GET = withRouteHandler(getHandler);
