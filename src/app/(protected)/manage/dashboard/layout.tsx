import { Suspense } from "react";
import { DashboardShell } from "./DashboardShell";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function DashboardLayout({
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
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}

