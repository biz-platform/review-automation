"use client";

import Link from "next/link";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useMeBilling } from "@/lib/hooks/use-me-billing";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatKstYmdHmDots } from "@/lib/billing/format-billing-display";
import type { MeBillingInvoiceData } from "@/lib/api/billing-api";
import { cn } from "@/lib/utils/cn";
import { BillingTableScroll } from "@/components/billing/BillingTableScroll";
import { ContentStateMessage } from "@/components/ui/content-state-message";

function formatKst(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
}

function paymentStatusLabel(s: MeBillingInvoiceData["paymentStatus"]) {
  return s === "completed" ? "결제 완료" : "결제 오류";
}

function UsageStatusBadge({
  status,
}: {
  status: MeBillingInvoiceData["usageStatus"];
}) {
  if (status === "active") {
    return <Badge variant="billingUsageActive">사용 중</Badge>;
  }
  if (status === "suspended") {
    return <Badge variant="billingUsageSuspended">이용 중지</Badge>;
  }
  return <Badge variant="billingUsageExpired">사용 만료</Badge>;
}

const COL_TEMPLATE =
  "grid-cols-[minmax(0,15fr)_minmax(0,15fr)_minmax(0,15fr)_minmax(0,25fr)_minmax(0,10fr)_minmax(0,10fr)_minmax(0,10fr)]";

function BillingHistoryTable({
  invoices,
}: {
  invoices: MeBillingInvoiceData[];
}) {
  return (
    <BillingTableScroll>
      <div className="min-w-[880px]">
        <div
          className={cn(
            "grid bg-wgray-02 text-left typo-body-03-bold text-white",
            COL_TEMPLATE,
          )}
        >
          <div className="col-span-5 border-r border-white/20 px-4 py-3">
            결제 정보
          </div>
          <div className="col-span-2 px-4 py-3">처리 상태</div>
        </div>
        <div
          className={cn(
            "grid border-b border-gray-07 bg-gray-08 text-left typo-body-03-bold text-gray-01",
            COL_TEMPLATE,
          )}
        >
          <div className="border-r border-gray-07 px-4 py-3">결제 번호</div>
          <div className="border-r border-gray-07 px-4 py-3">구독 플랜</div>
          <div className="border-r border-gray-07 px-4 py-3">결제 일시</div>
          <div className="border-r border-gray-07 px-4 py-3">이용 기간</div>
          <div className="border-r border-gray-07 px-4 py-3">청구 금액</div>
          <div className="border-r border-gray-07 px-4 py-3">결제 상태</div>
          <div className="px-4 py-3">이용 상태</div>
        </div>
        {invoices.length === 0 ? (
          <div className="bg-white px-4 py-12 text-center typo-body-02-regular text-gray-04">
            청구된 내역이 없습니다
          </div>
        ) : (
          invoices.map((row) => (
            <div
              key={row.id}
              className={cn(
                "grid border-b border-gray-07 bg-white text-left last:border-b-0",
                COL_TEMPLATE,
              )}
            >
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01">
                {row.invoiceCode}
              </div>
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01">
                {row.planName}
              </div>
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01 tabular-nums">
                {formatKstYmdHmDots(row.paidAt)}
              </div>
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01 tabular-nums">
                {formatKstYmdHmDots(row.usagePeriodStart)} -{" "}
                {formatKstYmdHmDots(row.usagePeriodEnd)}
              </div>
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01 tabular-nums">
                {row.amountWon.toLocaleString("ko-KR")}원
              </div>
              <div className="flex min-w-0 items-center justify-start border-r border-gray-07 px-4 py-4 typo-body-02-regular text-gray-01">
                {paymentStatusLabel(row.paymentStatus)}
              </div>
              <div className="flex min-w-0 items-center justify-start px-4 py-4">
                <UsageStatusBadge status={row.usageStatus} />
              </div>
            </div>
          ))
        )}
      </div>
    </BillingTableScroll>
  );
}

export function BillingPaymentShell() {
  const { data: onboarding, isSuccess: onboardingOk } = useOnboarding();
  const billingQ = useMeBilling();

  if (!onboardingOk || !onboarding) {
    return (
      <div className="w-full min-w-0">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  if (billingQ.isError) {
    return (
      <div className="w-full min-w-0">
        <h1 className="mb-4 typo-heading-02-bold text-gray-01">결제 관리</h1>
        <p className="typo-body-02-regular text-red-01">
          결제 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
      </div>
    );
  }

  if (!billingQ.isSuccess || !billingQ.data) {
    return (
      <div className="w-full min-w-0">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  const billing = billingQ.data;

  const { paymentRequired, freeAccessEndsAt } = onboarding.subscription;

  return (
    <div className="w-full min-w-0">
      <h1 className="mb-8 typo-heading-02-bold text-gray-01">결제 관리</h1>

      {paymentRequired && onboarding.role === "member" ? (
        <div className="mb-8 rounded-lg bg-main-05 px-4 py-3 typo-body-02-regular text-gray-02">
          무료 이용이 종료되어 결제 등록이 필요합니다.{" "}
          <Link
            href="/manage/billing/payment/card"
            className="font-bold text-main-01 underline underline-offset-2"
          >
            카드정보 변경에서 등록해 주세요
          </Link>
          <span className="mt-1 block typo-body-03-regular text-gray-04">
            무료 혜택 종료 시점: {formatKst(freeAccessEndsAt)} (한국 시각)
          </span>
        </div>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-4 typo-heading-02-bold text-gray-01">
          등록된 결제 수단
        </h2>
        <div className="flex w-full min-w-0 flex-col gap-4 rounded-lg border border-gray-07 bg-gray-08 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="shrink-0 typo-body-02-bold text-gray-01">
            카드 간편결제
          </p>
          <p className="min-w-0 flex-1 text-center typo-body-02-regular sm:text-left">
            {billing.cardMask != null ? (
              <span className="text-gray-01">{billing.cardMask}</span>
            ) : (
              <span className="text-gray-04">등록된 결제 수단이 없습니다</span>
            )}
          </p>
          <ButtonLink
            href="/manage/billing/payment/card"
            variant="secondary"
            size="md"
            className="h-10 w-full shrink-0 justify-center rounded-lg px-5 sm:w-auto"
          >
            카드정보 변경
          </ButtonLink>
        </div>
      </section>

      <section>
        <h2 className="mb-4 typo-heading-02-bold text-gray-01">청구 내역</h2>
        <BillingHistoryTable invoices={billing.invoices} />
      </section>
    </div>
  );
}
