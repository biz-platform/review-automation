import { Suspense } from "react";
import { GlanceSummarySection } from "../_components/GlanceSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function DashboardSummaryPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <GlanceSummarySection />
    </Suspense>
  );
}

