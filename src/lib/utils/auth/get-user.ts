import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AppUnauthorizedError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie 헤더 파싱 (cookies()가 비어 있을 때 폴백) */
function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header?.trim()) return [];
  return header.split(";").map((part) => {
    const eq = part.trim().indexOf("=");
    if (eq <= 0) return { name: part.trim(), value: "" };
    return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
  });
}

/**
 * Route Handler에서 사용.
 * cookies() 우선 사용, 비어 있으면 요청 Cookie 헤더로 폴백(proxy 환경 대응).
 */
export async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  let list = cookieStore.getAll();
  if (list.length === 0) {
    const cookieHeader = request.headers.get("cookie");
    list = parseCookieHeader(cookieHeader);
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_KEY,
    {
      cookies: {
        getAll: () => list,
        setAll: () => {},
      },
    }
  );

  /** 서버 검증은 getUser() 한 번으로 충분. getSession() 중복 호출 시 로컬에서 Supabase 왕복 2배. */
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    throw new AppUnauthorizedError({
      ...ERROR_CODES.UNAUTHORIZED,
      detail: "No session",
    });
  }

  return { user, supabase };
}
