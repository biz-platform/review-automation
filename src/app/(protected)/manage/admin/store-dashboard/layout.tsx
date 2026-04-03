import { Suspense } from "react";
import { StoreDashboardShell } from "./StoreDashboardShell";

export default function StoreDashboardLayout({
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
      <StoreDashboardShell>{children}</StoreDashboardShell>
    </Suspense>
  );
}
