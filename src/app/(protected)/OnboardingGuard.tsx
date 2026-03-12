"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useAiSettingsRequired } from "./AiSettingsRequiredContext";

const SETTINGS_PATH = "/manage/reviews/settings";

/** 리뷰 관리·구매 및 청구 진입 시 AI 설정 미완료면 모달로 막음. 직접 URL 접근 시에도 동일 모달 표시. */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: onboarding, isSuccess } = useOnboarding();
  const { setOnRestrictedPage } = useAiSettingsRequired() ?? { setOnRestrictedPage: () => {} };

  const isSettingsPage = pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
  const isReviewsArea = pathname === "/manage/reviews" || (pathname.startsWith("/manage/reviews/") && !isSettingsPage);
  const isBillingArea = pathname.startsWith("/manage/billing");
  const isManageRoot = pathname === "/manage";
  const requiresAiSettings = isManageRoot || isReviewsArea || isBillingArea;
  const shouldBlock = Boolean(isSuccess && onboarding?.hasStores && !onboarding?.aiSettingsCompleted && requiresAiSettings);

  useEffect(() => {
    setOnRestrictedPage(shouldBlock);
    return () => setOnRestrictedPage(false);
  }, [shouldBlock, setOnRestrictedPage]);

  return <>{children}</>;
}
