import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { AppUnauthorizedError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Cookie 헤더 파싱 (Route Handler에서 cookies()가 비어 있을 때 사용) */
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
 * Next.js 16: proxy 이후 cookies()가 비어 있어서, 요청의 Cookie 헤더로 클라이언트 생성.
 */
export async function getUser(request: NextRequest) {
  const cookieHeader = request.headers.get("cookie");
  const list = parseCookieHeader(cookieHeader);

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

  const { data: userData } = await supabase.auth.getUser();
  const { data: sessionData } = await supabase.auth.getSession();
  const user = userData?.user ?? sessionData?.session?.user;

  if (!user) {
    throw new AppUnauthorizedError({
      ...ERROR_CODES.UNAUTHORIZED,
      detail: "No session",
    });
  }

  return { user, supabase };
}
