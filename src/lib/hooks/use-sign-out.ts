"use client";

import { useCallback, useState } from "react";

/**
 * 로그아웃 공통 훅. GET /api/auth/signout으로 이동하면 서버가 쿠키 삭제 후 302로 /login 리다이렉트.
 * fetch 후 location 대입은 /manage 등에서 동작하지 않는 경우가 있어, 브라우저 직접 이동 방식 사용.
 * SignOutButton, GNBUserMenu 등에서 사용.
 */
export function useSignOut() {
  const [isPending, setIsPending] = useState(false);

  const signOut = useCallback(() => {
    if (isPending) return;
    setIsPending(true);
    window.location.href = "/api/auth/signout";
  }, [isPending]);

  return { signOut, isPending };
}
