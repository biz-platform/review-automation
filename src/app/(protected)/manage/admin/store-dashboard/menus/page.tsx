import { Suspense } from "react";
import { AdminMenuSummarySection } from "../_components/AdminMenuSummarySection";

export default function StoreDashboardMenusPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <AdminMenuSummarySection />
    </Suspense>
  );
}
