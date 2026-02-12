"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/db/supabase";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-sm text-muted-foreground underline"
    >
      로그아웃
    </button>
  );
}
