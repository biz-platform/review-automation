import { Suspense } from "react";
import { ReviewAnalysisSection } from "@/app/(protected)/manage/_components/ReviewAnalysisSection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoreDashboardReviewsAnalysisPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <ReviewAnalysisSection variant="admin" />
    </Suspense>
  );
}
