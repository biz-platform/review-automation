import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ENV_KEY } from "@/lib/config/env-keys";

const LOGIN_URL = new URL(
  "/login",
  process.env[ENV_KEY.NEXT_PUBLIC_VERCEL_URL]?.trim() ?? "http://localhost:3000",
).href;

const SUPABASE_KEY =
  process.env[ENV_KEY.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY] ??
  process.env[ENV_KEY.NEXT_PUBLIC_SUPABASE_ANON_KEY]!;

/**
 * signOut 시 쿠키 삭제를 리다이렉트 응답에 반영해야 함.
 * createServerSupabaseClient()의 cookieStore.set()은 반환할 NextResponse와 별개라
 * redirect 응답에 Set-Cookie가 안 붙어서 로그아웃 후에도 세션이 남는 문제가 있음.
 */
async function doSignOut(request: NextRequest) {
  const cookiesToSet: { name: string; value: string; options?: { path?: string; maxAge?: number } }[] = [];
  const supabase = createServerClient(
    process.env[ENV_KEY.NEXT_PUBLIC_SUPABASE_URL]!,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies: { name: string; value: string; options?: { path?: string; maxAge?: number } }[]) {
          cookiesToSet.push(...cookies);
        },
      },
    }
  );
  await supabase.auth.signOut();

  const res = NextResponse.redirect(LOGIN_URL, { status: 302 });
  cookiesToSet.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, { path: "/", ...options });
  });
  return res;
}

export async function GET(request: NextRequest) {
  return doSignOut(request);
}

export async function POST(request: NextRequest) {
  return doSignOut(request);
}
