"use client";

import { Suspense } from "react";
import { StoresPageContent } from "./stores-page-content";

export default function StoresPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <p className="typo-body-02-regular text-gray-04">로딩 중…</p>
        </div>
      }
    >
      <StoresPageContent />
    </Suspense>
  );
}
