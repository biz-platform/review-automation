import { Suspense } from "react";
import { MenuSummarySection } from "../_components/MenuSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function DashboardMenusPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <MenuSummarySection />
    </Suspense>
  );
}

