import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** cookies()가 비어 있을 때 Route Handler에서만 사용 (getUser와 동일 폴백). */
function cookieListFromRequestHeader(request: NextRequest | undefined): {
  name: string;
  value: string;
}[] {
  const header = request?.headers.get("cookie");
  if (!header?.trim()) return [];
  return header.split(";").map((part) => {
    const eq = part.trim().indexOf("=");
    if (eq <= 0) return { name: part.trim(), value: "" };
    return {
      name: part.slice(0, eq).trim(),
      value: part.slice(eq + 1).trim(),
    };
  });
}

/**
 * @param request Route Handler에서 전달 시 `cookies()`가 비어도 Cookie 헤더로 세션 복원 가능 (프록시·일부 호스팅).
 */
export async function createServerSupabaseClient(request?: NextRequest) {
  if (process.env.WORKER_MODE === "1") {
    return createServiceRoleClient();
  }
  const cookieStore = await cookies();
  let cookieList = cookieStore.getAll();
  if (cookieList.length === 0 && request) {
    cookieList = cookieListFromRequestHeader(request);
  }
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    key,
    {
      cookies: {
        getAll() {
          return cookieList;
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore in Server Components
          }
        },
      },
    }
  );
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
