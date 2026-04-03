import { Suspense } from "react";
import { DashboardShell } from "./DashboardShell";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="typo-body-02-regular text-gray-03">불러오는 중…</div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

