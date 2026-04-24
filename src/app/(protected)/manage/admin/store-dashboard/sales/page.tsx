import { Suspense } from "react";
import { SalesSummarySection } from "@/app/(protected)/manage/dashboard/_components/SalesSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoreDashboardSalesPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <SalesSummarySection variant="admin" />
    </Suspense>
  );
}
