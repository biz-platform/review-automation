"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/hooks/use-onboarding";

const PAYMENT_PATH = "/manage/billing/payment";
const PLAN_PATH = "/manage/billing/plan";

/** 결제 필요 시에도 접근 허용: 결제 안내·이용 현황·계정 관리·셀러 신청 */
const MANAGE_PATHS_ALLOWED_WHEN_PAYMENT_REQUIRED = [
  PAYMENT_PATH,
  PLAN_PATH,
  "/manage/billing/usage",
  "/manage/mypage",
  "/manage/sellers/apply",
] as const;

function isAllowedWhenPaymentRequired(pathname: string): boolean {
  return MANAGE_PATHS_ALLOWED_WHEN_PAYMENT_REQUIRED.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/** 일반 회원·무료기간 만료 시 /manage 전역에서 결제 안내로 유도 (위 허용 경로·어드민 제외) */
export function BillingSubscriptionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: onboarding, isSuccess } = useOnboarding();

  useEffect(() => {
    if (!isSuccess || !onboarding) return;
    if (!pathname.startsWith("/manage")) return;
    if (onboarding.isAdmin) return;
    if (onboarding.role !== "member") return;
    if (!onboarding.subscription.paymentRequired) return;
    if (isAllowedWhenPaymentRequired(pathname)) return;
    router.replace(PAYMENT_PATH);
  }, [isSuccess, onboarding, pathname, router]);

  return <>{children}</>;
}
