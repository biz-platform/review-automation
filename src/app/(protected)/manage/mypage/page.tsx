import { Suspense } from "react";
import { MypageContent } from "@/app/(protected)/manage/mypage/mypage-content";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function MypagePage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="로딩 중…" />
      }
    >
      <MypageContent />
    </Suspense>
  );
}
