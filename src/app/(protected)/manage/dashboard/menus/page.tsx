import { Suspense } from "react";
import { MenuSummarySection } from "../_components/MenuSummarySection";

export default function DashboardMenusPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <MenuSummarySection />
    </Suspense>
  );
}

