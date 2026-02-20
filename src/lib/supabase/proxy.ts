import { createServerClient } from "@supabase/ssr";
import { NextResponse, NextRequest } from "next/server";

const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase 공식 권장: proxy에서 세션 갱신.
 * setAll에서 request.cookies + response.cookies 둘 다 갱신해야
 * 이후 Server Components / Route Handlers의 cookies()가 갱신된 값을 읽음.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Next.js 16: request.cookies는 읽기 전용. response에만 설정.
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // 공식: createServerClient 직후 호출로 세션 갱신 (토큰 갱신 후 request/response 쿠키 동기화).
  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith("/stores") || pathname.startsWith("/reviews");
  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/auth");

  if (isProtected && user == null && !isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Next.js 16: proxy 이후 cookies()가 비어 있을 수 있음. user 있으면 헤더로 전달.
  if (user) {
    const userId = typeof user === "object" && user !== null && "id" in user
      ? String((user as { id: string }).id)
      : String(user);
    const reqHeaders = new Headers(request.headers);
    reqHeaders.set("x-supabase-user-id", userId);
    const modifiedRequest = new NextRequest(request.url, { headers: reqHeaders });
    const res = NextResponse.next({ request: modifiedRequest });
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c.name, c.value));
    return res;
  }

  return supabaseResponse;
}
