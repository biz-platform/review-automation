import { Suspense } from "react";
import { MypageContent } from "@/app/(protected)/manage/mypage/mypage-content";

export default function MypagePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <p className="typo-body-02-regular text-gray-04">로딩 중…</p>
        </div>
      }
    >
      <MypageContent />
    </Suspense>
  );
}
