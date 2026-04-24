import { Suspense } from "react";
import { GlanceSummarySection } from "@/app/(protected)/manage/dashboard/_components/GlanceSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoreDashboardSummaryPage() {
  return (
    <Suspense
      fallback={<ContentStateMessage variant="loading" message="불러오는 중…" />}
    >
      <GlanceSummarySection variant="admin" />
    </Suspense>
  );
}
