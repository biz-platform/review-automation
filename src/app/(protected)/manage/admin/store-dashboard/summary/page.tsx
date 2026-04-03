import { Suspense } from "react";
import { GlanceSummarySection } from "../_components/GlanceSummarySection";

export default function StoreDashboardSummaryPage() {
  return (
    <Suspense
      fallback={
        <p className="typo-body-02-regular text-gray-03">불러오는 중…</p>
      }
    >
      <GlanceSummarySection />
    </Suspense>
  );
}
