import { NextRequest, NextResponse } from "next/server";
import type { MeProfileData } from "@/lib/api/me-api";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

/** GET: 현재 로그인 사용자 프로필. 프로덕션에서 is_admin이 안 나오면 마이그레이션 034 적용·재배포 확인 */
async function getHandler(request: NextRequest) {
  const { user, supabase } = await getUser(request);
  const { data: profile } = await supabase
    .from("users")
    .select("phone, is_seller, is_admin, role")
    .eq("id", user.id)
    .maybeSingle();

  const result: MeProfileData = {
    email: user.email ?? null,
    phone: (profile?.phone as string | null) ?? null,
    is_seller: profile?.is_seller ?? false,
    is_admin: profile?.is_admin ?? false,
    role: (profile?.role as MeProfileData["role"]) ?? "member",
  };
  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
