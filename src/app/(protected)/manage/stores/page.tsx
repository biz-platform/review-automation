"use client";

import { Suspense } from "react";
import { StoresPageContent } from "@/app/(protected)/manage/stores/stores-page-content";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function StoresPage() {
  return (
    <Suspense
      fallback={
        <ContentStateMessage variant="loading" message="로딩 중…" />
      }
    >
      <StoresPageContent />
    </Suspense>
  );
}
