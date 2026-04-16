import { Suspense } from "react";
import { ReviewAnalysisSection } from "@/app/(protected)/manage/_components/ReviewAnalysisSection";

export default function StoreDashboardReviewsAnalysisPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <ReviewAnalysisSection variant="admin" />
    </Suspense>
  );
}
