"use client";

import { useSignOut } from "@/lib/hooks/use-sign-out";

export function SignOutButton() {
  const { signOut, isPending } = useSignOut();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      disabled={isPending}
      className="text-sm text-muted-foreground underline disabled:opacity-50"
    >
      로그아웃
    </button>
  );
}
