import { Suspense } from "react";
import { MenuSummarySection } from "@/app/(protected)/manage/dashboard/_components/MenuSummarySection";

export default function StoreDashboardMenusPage() {
  return (
    <Suspense
      fallback={<p className="typo-body-02-regular text-gray-03">불러오는 중…</p>}
    >
      <MenuSummarySection variant="admin" />
    </Suspense>
  );
}
