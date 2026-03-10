"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/db/supabase";
import type { User } from "@supabase/supabase-js";

export type AuthSessionUser = { email: string; name: string };

function toSessionUser(u: User): AuthSessionUser {
  return {
    email: u.email ?? "",
    name:
      (u.user_metadata?.name as string | undefined) ??
      u.email?.split("@")[0] ??
      "",
  };
}

/**
 * Supabase auth 세션 구독. 로그인 여부·유저 정보가 필요한 컴포넌트(GNB 등)에서 사용.
 */
export function useAuthSession(): AuthSessionUser | null {
  const [user, setUser] = useState<AuthSessionUser | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toSessionUser(session.user) : null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toSessionUser(session.user) : null);
    });
    return () => subscription.unsubscribe();
  }, []);

  return user;
}
