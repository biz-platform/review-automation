import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

/** GET: 현재 로그인 사용자 프로필 (이메일, 휴대전화). 계정 관리 페이지용 */
async function getHandler(request: NextRequest) {
  const { user, supabase } = await getUser(request);
  const { data: profile } = await supabase
    .from("users")
    .select("phone, is_seller, role")
    .eq("id", user.id)
    .maybeSingle();

  return NextResponse.json({
    result: {
      email: user.email ?? null,
      phone: (profile?.phone as string | null) ?? null,
      is_seller: profile?.is_seller ?? false,
      role: (profile?.role as "member" | "center_manager" | "planner") ?? "member",
    },
  });
}

export const GET = withRouteHandler(getHandler);
