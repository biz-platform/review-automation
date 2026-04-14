import { Suspense } from "react";
import { AdminSalesSummarySection } from "../_components/AdminSalesSummarySection";

export default function StoreDashboardSalesPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <AdminSalesSummarySection />
    </Suspense>
  );
}
