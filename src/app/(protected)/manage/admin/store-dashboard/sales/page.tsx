import { Suspense } from "react";
import { SalesSummarySection } from "@/app/(protected)/manage/dashboard/_components/SalesSummarySection";

export default function StoreDashboardSalesPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <SalesSummarySection variant="admin" />
    </Suspense>
  );
}
