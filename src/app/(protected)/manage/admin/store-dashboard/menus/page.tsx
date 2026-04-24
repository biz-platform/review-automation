import { Suspense } from "react";
import { MenuSummarySection } from "@/app/(protected)/manage/dashboard/_components/MenuSummarySection";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoreDashboardMenusPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      }
    >
      <MenuSummarySection variant="admin" />
    </Suspense>
  );
}
