import { Suspense } from "react";
import SettingsPageContent from "./settings-page-content";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function ReviewSettingsPage() {
  return (
    <div className="flex flex-col">
      <h1 className="typo-heading-02-bold mb-2 text-gray-01">AI 댓글 설정</h1>
      <p className="typo-body-02-regular mb-8 text-gray-04">
        우리 가게에 맞는 AI 말투와 댓글 길이를 설정할 수 있어요.
      </p>
      <Suspense
        fallback={
          <ContentStateMessage variant="loading" message="로딩 중…" />
        }
      >
        <SettingsPageContent />
      </Suspense>
    </div>
  );
}
