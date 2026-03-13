"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useAiSettingsRequired } from "./AiSettingsRequiredContext";
import { useStoreLinkRequired } from "./StoreLinkRequiredContext";

const SETTINGS_PATH = "/manage/reviews/settings";

/** 리뷰 관리(설정 포함)·구매 및 청구 구역 — 연동된 매장 0개 시 진입 차단 */
const isReviewsOrBillingArea = (pathname: string) =>
  pathname.startsWith("/manage/reviews") || pathname.startsWith("/manage/billing");

/** 연동된 매장 0개면 리뷰/구매·청구 접근 차단(신규 유저 취급). AI 설정 미완료 시 동일 구역 차단. */
export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: onboarding, isSuccess } = useOnboarding();
  const { setOnRestrictedPage } = useAiSettingsRequired() ?? { setOnRestrictedPage: () => {} };
  const { setOnRestrictedPage: setOnStoreLinkRestricted } = useStoreLinkRequired() ?? {
    setOnRestrictedPage: () => {},
  };

  const isSettingsPage =
    pathname === SETTINGS_PATH || pathname.startsWith(`${SETTINGS_PATH}/`);
  const isReviewsArea =
    pathname === "/manage/reviews" ||
    (pathname.startsWith("/manage/reviews/") && !isSettingsPage);
  const isBillingArea = pathname.startsWith("/manage/billing");
  const isManageRoot = pathname === "/manage";
  const requiresStoreLink =
    isSuccess && !onboarding?.hasLinkedStores && isReviewsOrBillingArea(pathname);
  const requiresAiSettings =
    isManageRoot || isReviewsArea || isBillingArea;
  const shouldBlockAiSettings = Boolean(
    isSuccess &&
      onboarding?.hasLinkedStores &&
      !onboarding?.aiSettingsCompleted &&
      requiresAiSettings,
  );

  useEffect(() => {
    setOnStoreLinkRestricted(requiresStoreLink);
    return () => setOnStoreLinkRestricted(false);
  }, [requiresStoreLink, setOnStoreLinkRestricted]);

  useEffect(() => {
    setOnRestrictedPage(shouldBlockAiSettings);
    return () => setOnRestrictedPage(false);
  }, [shouldBlockAiSettings, setOnRestrictedPage]);

  return <>{children}</>;
}
