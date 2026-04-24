import { Suspense } from "react";
import { StoreDashboardShell } from "./StoreDashboardShell";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoreDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <ContentStateMessage
          variant="loading"
          message="불러오는 중…"
          className="min-h-screen"
        />
      }
    >
      <StoreDashboardShell>{children}</StoreDashboardShell>
    </Suspense>
  );
}
