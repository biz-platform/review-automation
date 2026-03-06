import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppShell } from "./AppShell";
import { ProtectedLayoutContent } from "./ProtectedLayoutContent";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  if (h.get("x-supabase-user-id")) {
    return (
      <AppShell>
        <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
      </AppShell>
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: { session } } = await supabase.auth.getSession();
  const currentUser = user ?? session?.user;

  if (!currentUser) {
    redirect("/login");
  }

  return (
    <AppShell>
      <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
    </AppShell>
  );
}
