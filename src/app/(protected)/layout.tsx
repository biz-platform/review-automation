import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { SignOutButton } from "@/components/shared/SignOutButton";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border px-4 py-3">
        <nav className="flex items-center gap-4">
          <a href="/stores" className="font-medium">
            매장 관리
          </a>
          <a href="/reviews/manage" className="font-medium">
            리뷰 관리
          </a>
          <a href="/" className="text-muted-foreground">
            홈
          </a>
          <span className="ml-auto">
            <SignOutButton />
          </span>
        </nav>
      </header>
      {children}
    </div>
  );
}
