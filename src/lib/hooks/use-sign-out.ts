"use client";

import { useCallback, useState } from "react";

/**
 * 로그아웃 공통 훅. POST /api/auth/signout 후 /login으로 이동.
 * SignOutButton, GNBUserMenu 등에서 사용.
 */
export function useSignOut() {
  const [isPending, setIsPending] = useState(false);

  const signOut = useCallback(async () => {
    if (isPending) return;
    setIsPending(true);
    try {
      await fetch("/api/auth/signout", {
        method: "POST",
        credentials: "same-origin",
      });
      window.location.href = "/login";
    } finally {
      setIsPending(false);
    }
  }, [isPending]);

  return { signOut, isPending };
}
