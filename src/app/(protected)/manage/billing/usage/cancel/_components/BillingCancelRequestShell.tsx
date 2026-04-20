"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { usePostMeSubscriptionCancelAtPeriodEnd } from "@/lib/hooks/use-me-subscription-cancel-at-period-end";
import {
  formatKoreanLongKstYmd,
  lastServiceKstYmdBeforeAutoCancel,
} from "@/lib/billing/format-korean-kst-date";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";

export function BillingCancelRequestShell() {
  const router = useRouter();
  const { addToast } = useToast();
  const { data: onboarding, isSuccess } = useOnboarding();
  const cancelMutation = usePostMeSubscriptionCancelAtPeriodEnd();
  const [completeOpen, setCompleteOpen] = useState(false);

  const u = onboarding?.subscription.usage;
  const valid =
    !!u &&
    (u.kind === "member_paid" || u.kind === "planner_paid") &&
    !!u.autoCancelKstYmd &&
    !u.cancelAtPeriodEnd;

  useEffect(() => {
    if (!isSuccess || !onboarding) return;
    if (!valid) {
      router.replace("/manage/billing/usage");
    }
  }, [isSuccess, onboarding, router, valid]);

  if (!isSuccess || !onboarding || !u) {
    return (
      <div className="w-full min-w-0 pb-32">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <div className="w-full min-w-0 pb-32">
        <p className="typo-body-02-regular text-gray-04">이동 중…</p>
      </div>
    );
  }

  const autoYmd = u.autoCancelKstYmd!;
  const autoDisplay = formatKoreanLongKstYmd(autoYmd);
  const lastDayYmd = lastServiceKstYmdBeforeAutoCancel(autoYmd);
  const lastDayDisplay = formatKoreanLongKstYmd(lastDayYmd);

  const onSubmitCancel = () => {
    cancelMutation.mutate(undefined, {
      onSuccess: () => {
        setCompleteOpen(true);
      },
      onError: (e) => {
        addToast(
          e instanceof Error ? e.message : "해지 신청에 실패했습니다.",
        );
      },
    });
  };

  return (
    <div className="w-full min-w-0 pb-48 lg:pb-40">
      <nav className="mb-6 flex items-center gap-1 typo-body-02-regular text-gray-04">
        <Link
          href="/manage/billing/usage"
          className="inline-flex items-center gap-0.5 text-gray-04 hover:text-gray-02"
        >
          <ChevronLeftIcon className="h-5 w-5 shrink-0" aria-hidden />
          이용 현황
        </Link>
        <span className="text-gray-06" aria-hidden>
          /
        </span>
        <span className="text-gray-01">해지 신청</span>
      </nav>

      <h1 className="typo-heading-02-bold text-gray-01">해지 신청</h1>
      <p className="mt-2 typo-body-02-regular text-gray-04">
        그동안 올리뷰 서비스를 이용해주셔서 감사드립니다
      </p>

      <div className="mt-8 divide-y divide-gray-07 rounded-lg border border-gray-07 bg-white px-4 sm:px-6">
        <div className="flex w-full min-w-0 items-center justify-between gap-4 py-4">
          <p className="shrink-0 typo-body-02-bold text-gray-01">구독 플랜</p>
          <p className="min-w-0 flex-1 text-right typo-body-02-regular text-gray-01">
            {u.planName}
          </p>
        </div>
        <div className="flex w-full min-w-0 items-start justify-between gap-4 py-4">
          <p className="shrink-0 typo-body-02-bold text-gray-01">자동 해지일</p>
          <div className="min-w-0 flex-1 text-right">
            <p className="typo-body-02-regular text-gray-01">{autoDisplay}</p>
            <p className="mt-1 typo-body-03-regular text-gray-04">
              {lastDayDisplay}까지 이용할 수 있어요
            </p>
          </div>
        </div>
      </div>

      <PageFixedBottomBar
        className={cn(
          "w-full flex-col gap-4",
          "px-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:px-8",
        )}
      >
        <div className="flex flex-col gap-1 text-center lg:max-w-3xl lg:text-left">
          <p className="typo-body-02-regular text-red-01">
            해지 시 잔여 기간 요금은 환불되지 않습니다
          </p>
          <p className="typo-body-03-regular text-gray-04">
            단, 결제일로부터 7일 이내 서비스 미이용 시 고객센터를 통해 환불을
            신청하실 수 있습니다
          </p>
        </div>

        <div className="flex w-full flex-row gap-2 lg:w-auto lg:flex-none lg:justify-end">
          <Button
            type="button"
            variant="secondaryDark"
            size="md"
            className="h-[48px] flex-1 rounded-lg lg:hidden"
            onClick={() => router.push("/manage/billing/usage")}
          >
            취소하기
          </Button>
          <Button
            type="button"
            size="md"
            disabled={cancelMutation.isPending}
            className={cn(
              "h-[48px] flex-1 rounded-lg border-0 bg-[#F2A391] px-6 text-white outline-1 outline-[#F2A391]",
              "not-disabled:hover:opacity-90 lg:min-w-31 lg:flex-none",
            )}
            onClick={onSubmitCancel}
          >
            해지하기
          </Button>
        </div>
      </PageFixedBottomBar>

      <Modal
        open={completeOpen}
        onOpenChange={(o) => {
          if (!o) {
            setCompleteOpen(false);
            router.push("/manage/billing/usage");
          }
        }}
        title="해지 신청이 완료되었어요"
        description={
          <div className="flex flex-col gap-2 typo-body-02-regular text-gray-03">
            <p>
              {lastDayDisplay}까지 이용하실 수 있으며, {autoDisplay}부터 정기
              결제가 이루어지지 않습니다.
            </p>
          </div>
        }
        footer={
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={() => {
              setCompleteOpen(false);
              router.push("/manage/billing/usage");
            }}
          >
            확인
          </Button>
        }
      />
    </div>
  );
}
