"use client";

import { usePathname } from "next/navigation";
import { GNB } from "@/components/layout/GNB";
import { SNB } from "@/components/layout/SNB";
import { AdminSNB } from "@/components/layout/AdminSNB";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: profile } = useAccountProfile();
  const isAdminRoute = pathname.startsWith("/manage/admin");
  const isAdmin = profile?.is_admin ?? false;

  return (
    <div className="flex min-h-screen flex-col">
      <GNB />

      <div className="flex min-h-0 flex-1">
        {isAdminRoute && isAdmin ? <AdminSNB /> : <SNB />}

        <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-white">
          <div
            className={
              "min-w-0 p-4 lg:w-(--layout-content-width) lg:p-0 lg:pt-(--layout-content-padding-top) lg:pb-(--layout-content-padding-bottom) lg:pl-(--layout-content-padding-left) lg:pr-(--layout-content-padding-right)"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
