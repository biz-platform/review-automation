import { Suspense } from "react";
import SettingsPageContent from "./settings-page-content";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function ReviewSettingsPage() {
  return (
    <div className="flex flex-col">
      <Suspense
        fallback={<ContentStateMessage variant="loading" message="로딩 중…" />}
      >
        <SettingsPageContent />
      </Suspense>
    </div>
  );
}
