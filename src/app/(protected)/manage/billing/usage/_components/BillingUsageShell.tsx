"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { usePostMeSubscriptionResumeAtPeriodEnd } from "@/lib/hooks/use-me-subscription-resume-at-period-end";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/components/ui/toast";
import type { MeSubscriptionUsageData } from "@/lib/api/me-api";
import { ContentStateMessage } from "@/components/ui/content-state-message";

/** 라벨 굵게 · 값 보통 (피그마 스펙) */
function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-5 w-full min-w-0 items-center justify-between gap-4 leading-5">
      <p className="shrink-0 typo-body-02-bold text-gray-01">{label}</p>
      <p className="min-w-0 flex-1 text-right typo-body-02-regular text-gray-01 tabular-nums">
        {value}
      </p>
    </div>
  );
}

function StatusBadge({
  variant,
  surface,
  children,
}: {
  variant: MeSubscriptionUsageData["badgeVariant"];
  surface: "dark" | "light";
  children: string;
}) {
  if (variant === "active") {
    return <Badge variant="primary">{children}</Badge>;
  }

  if (variant === "cancel_pending") {
    return <Badge variant="cancelPending">{children}</Badge>;
  }

  if (variant === "trial") {
    return surface === "dark" ? (
      <Badge variant="orangeOnDark">{children}</Badge>
    ) : (
      <Badge variant="orange">{children}</Badge>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center rounded-full border px-3 py-1.5 typo-body-03-bold leading-none",
        surface === "light" &&
          variant === "inactive" &&
          "border-gray-07 bg-gray-08 text-gray-03",
        surface === "dark" &&
          variant === "inactive" &&
          "border-gray-06 bg-wgray-02 text-gray-06",
      )}
    >
      {children}
    </span>
  );
}

/** 피그마: 좌 다크 / 세로 구분 / 우 gray-08 / 하단 코랄 CTA */
function SubscriptionSplitCard({
  badgeVariant,
  badgeLine,
  planName,
  usagePeriodDots,
  currentFeeLine,
  nextBillingDots,
  cancelAtPeriodEnd,
  paymentBanner,
  billingFooter,
}: {
  badgeVariant: MeSubscriptionUsageData["badgeVariant"];
  badgeLine: string;
  planName: string;
  usagePeriodDots: string | null;
  currentFeeLine: string;
  nextBillingDots: string | null;
  cancelAtPeriodEnd: boolean;
  paymentBanner: ReactNode;
  billingFooter: ReactNode;
}) {
  return (
    <div className="mt-6 flex w-full min-w-0 overflow-hidden rounded-lg border border-gray-07 bg-background">
      <div className="flex w-full min-w-0 flex-col sm:min-h-[210px] lg:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-3 px-4 py-5 lg:w-[min(32%,302px)] lg:max-w-[320px]">
          <StatusBadge variant={badgeVariant} surface="dark">
            {badgeLine}
          </StatusBadge>
          <p className="typo-heading-02-regular min-h-6 leading-6">
            {planName}
          </p>
        </div>

        <div
          className="h-px w-full shrink-0 bg-gray-07 lg:hidden"
          aria-hidden
        />

        <div
          className="hidden w-px shrink-0 self-stretch bg-gray-07 lg:block"
          aria-hidden
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-gray-08 px-4 py-5 sm:px-6">
          <div className="flex w-full min-w-0 flex-col gap-3">
            {usagePeriodDots != null && (
              <UsageRow label="이용 기간" value={usagePeriodDots} />
            )}
            <UsageRow label="현재 이용 요금" value={currentFeeLine} />
            <UsageRow
              label={
                cancelAtPeriodEnd ? "자동 해지일" : "다음 결제 예정일"
              }
              value={nextBillingDots ?? "—"}
            />
          </div>

          {paymentBanner}

          {billingFooter}
        </div>
      </div>
    </div>
  );
}

export function BillingUsageShell() {
  const { data: onboarding, isSuccess } = useOnboarding();
  const { addToast } = useToast();
  const resumeMutation = usePostMeSubscriptionResumeAtPeriodEnd();
  const [freeEndOpen, setFreeEndOpen] = useState(false);

  if (!isSuccess || !onboarding) {
    return (
      <div className="w-full min-w-0">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  const u = onboarding.subscription.usage;
  /** 구분선 + 안내 + CTA 영역 (피그마와 동일 레이아웃) */
  const showSubscriptionFooter =
    u.kind === "member_free_trial" ||
    u.kind === "member_paid" ||
    u.kind === "planner_paid" ||
    u.kind === "admin_exempt" ||
    u.kind === "center_exempt";
  /** 실제 해지 플로우 가능 */
  const canUseEndRecurring =
    u.kind === "member_free_trial" ||
    u.kind === "member_paid" ||
    u.kind === "planner_paid";
  const showCancelResume =
    u.cancelAtPeriodEnd &&
    (u.kind === "member_free_trial" ||
      u.kind === "member_paid" ||
      u.kind === "planner_paid");

  const openFreeTrialEndModal = () => {
    if (u.kind === "member_free_trial") setFreeEndOpen(true);
  };

  const paymentBanner =
    onboarding.subscription.paymentRequired && onboarding.role === "member" ? (
      <div className="mt-6 rounded-lg bg-main-05 px-4 py-3 typo-body-02-regular text-gray-02">
        무료 이용이 종료되어 결제 등록이 필요합니다.{" "}
        <Link
          href="/manage/billing/payment"
          className="font-bold text-main-01 underline underline-offset-2"
        >
          결제 안내로 이동
        </Link>
      </div>
    ) : null;

  const billingFooter = showSubscriptionFooter ? (
    <div className="mt-6 flex w-full min-w-0 flex-col gap-4 border-t border-gray-07 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 typo-body-02-regular text-gray-01">
        {u.cancelAtPeriodEnd
          ? "서비스를 계속 이용하시겠어요?"
          : "다음 결제를 원하지 않으시나요?"}
      </p>
      {showCancelResume ? (
        <Button
          type="button"
          variant="secondary"
          size="md"
          disabled={resumeMutation.isPending}
          className="h-[38px] w-full shrink-0 justify-center rounded-lg px-5 sm:w-auto"
          onClick={() =>
            resumeMutation.mutate(undefined, {
              onSuccess: () => addToast("해지 예약을 취소했어요."),
              onError: (e) =>
                addToast(
                  e instanceof Error ? e.message : "처리에 실패했습니다.",
                ),
            })
          }
        >
          해지 취소하기
        </Button>
      ) : u.kind === "member_paid" || u.kind === "planner_paid" ? (
        <ButtonLink
          href="/manage/billing/usage/cancel"
          variant="destructive"
          size="md"
          className={cn(
            "h-[38px] w-full justify-center rounded-lg border-0 bg-[#EBA393] px-5 text-white outline-1 outline-[#EBA393]",
            "not-disabled:hover:opacity-90 sm:w-auto sm:min-w-31",
          )}
        >
          정기 결제 끝내기
        </ButtonLink>
      ) : (
        <Button
          type="button"
          variant="destructive"
          size="md"
          disabled={!canUseEndRecurring}
          className={cn(
            "h-[38px] w-full justify-center rounded-lg border-0 bg-[#EBA393] px-5 text-white outline-1 outline-[#EBA393]",
            "not-disabled:hover:opacity-90 sm:w-auto sm:min-w-31",
            "disabled:pointer-events-none disabled:opacity-40",
          )}
          onClick={openFreeTrialEndModal}
        >
          정기 결제 끝내기
        </Button>
      )}
    </div>
  ) : null;

  return (
    <div className="w-full min-w-0">
      <h1 className="mb-8 typo-heading-02-bold text-gray-01">이용 현황</h1>

      <SubscriptionSplitCard
        badgeVariant={u.badgeVariant}
        badgeLine={u.badgeLine}
        planName={u.planName}
        usagePeriodDots={u.usagePeriodDots}
        currentFeeLine={u.currentFeeLine}
        nextBillingDots={u.nextBillingDots}
        cancelAtPeriodEnd={u.cancelAtPeriodEnd}
        paymentBanner={paymentBanner}
        billingFooter={billingFooter}
      />

      <Modal
        open={freeEndOpen}
        onOpenChange={(o) => !o && setFreeEndOpen(false)}
        title="무료 이용 기간이 아직 남았어요"
        description={
          <div className="flex flex-col gap-2 typo-body-02-regular text-gray-03">
            <p>더 써보고 결정해도 괜찮아요</p>
            <p>해지 후 다시 이용하려면 결제 등록이 필요합니다</p>
          </div>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            size="md"
            className="bg-red-02 outline-red-02 not-disabled:hover:opacity-90"
            onClick={() => {
              setFreeEndOpen(false);
              addToast("정기 결제 해지는 아직 연결되지 않았습니다.");
            }}
          >
            이용 종료하기
          </Button>
        }
      />
    </div>
  );
}
