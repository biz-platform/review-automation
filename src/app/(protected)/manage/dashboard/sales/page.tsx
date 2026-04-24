import { Suspense } from "react";
import { SalesSummarySection } from "../_components/SalesSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function DashboardSalesPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <SalesSummarySection />
    </Suspense>
  );
}

