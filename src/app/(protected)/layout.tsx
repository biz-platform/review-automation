import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AiSettingsRequiredProvider } from "./AiSettingsRequiredContext";
import { StoreLinkRequiredProvider } from "./StoreLinkRequiredContext";
import { AppShell } from "./AppShell";
import { ProtectedLayoutContent } from "./ProtectedLayoutContent";

/**
 * proxy에서 이미 세션을 검사하고 x-supabase-user-id 헤더를 붙인 경우,
 * layout의 cookies()가 비어 있을 수 있어(Next.js 16 등) getUser()가 null을 반환한다.
 * 이때 헤더가 있으면 proxy가 인증된 것으로 보고 렌더만 한다.
 */
export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  if (h.get("x-supabase-user-id")) {
    return (
      <AiSettingsRequiredProvider>
        <StoreLinkRequiredProvider>
          <AppShell>
            <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
          </AppShell>
        </StoreLinkRequiredProvider>
      </AiSettingsRequiredProvider>
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
    <AiSettingsRequiredProvider>
      <StoreLinkRequiredProvider>
        <AppShell>
          <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
        </AppShell>
      </StoreLinkRequiredProvider>
    </AiSettingsRequiredProvider>
  );
}
