import { Suspense } from "react";
import { SalesSummarySection } from "../_components/SalesSummarySection";

export default function DashboardSalesPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <SalesSummarySection />
    </Suspense>
  );
}

