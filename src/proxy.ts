/**
 * Next.js 16: middleware 대신 proxy 진입점 사용.
 * 세션 갱신 후 x-supabase-user-id 헤더를 붙여 layout에서 Supabase 호출 스킵.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
