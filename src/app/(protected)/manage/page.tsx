"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useOnboarding } from "@/lib/hooks/use-onboarding";

/**
 * /manage 진입 시: 가게 없으면 매장 관리, 있으면 AI 설정 완료 여부에 따라 설정 또는 리뷰 관리로 이동.
 */
export default function ManagePage() {
  const router = useRouter();
  const { data: stores, isSuccess: storesSuccess, isError: storesError } = useStoreList();
  const { data: onboarding, isSuccess: onboardingSuccess } = useOnboarding();

  useEffect(() => {
    if (storesError) {
      router.replace("/manage/reviews");
      return;
    }
    if (!storesSuccess) return;
    const hasStores = Array.isArray(stores) && stores.length > 0;
    if (!hasStores) {
      router.replace("/manage/stores");
      return;
    }
    if (!onboardingSuccess || !onboarding) return;
    if (onboarding.hasStores && !onboarding.aiSettingsCompleted) {
      router.replace("/manage/reviews/settings");
    } else {
      router.replace("/manage/reviews");
    }
  }, [storesSuccess, storesError, stores, onboardingSuccess, onboarding, router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="typo-body-02-regular text-gray-04">이동 중…</p>
    </div>
  );
}
