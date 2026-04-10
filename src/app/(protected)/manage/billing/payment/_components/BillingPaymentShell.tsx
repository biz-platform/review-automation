"use client";

import { useOnboarding } from "@/lib/hooks/use-onboarding";

function formatKst(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(new Date(iso));
}

export function BillingPaymentShell() {
  const { data: onboarding, isSuccess } = useOnboarding();

  if (!isSuccess || !onboarding) {
    return (
      <div className="p-8">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  const { paymentRequired, freeAccessEndsAt } = onboarding.subscription;

  if (!paymentRequired) {
    return (
      <div className="p-8">
        <h1 className="typo-heading-01-bold text-gray-01">결제 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-04">
          현재 무료·이용 가능 기간이거나 유료 구독이 활성화된 상태입니다.
        </p>
        <p className="mt-2 typo-body-03-regular text-gray-05">
          무료 혜택 종료 예정: {formatKst(freeAccessEndsAt)} (한국 시각)
        </p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="typo-heading-01-bold text-gray-01">결제 안내</h1>
      <p className="mt-4 typo-body-02-regular text-gray-01">
        무료 이용 기간이 종료되어 정기 결제 등록이 필요합니다.
      </p>
      <p className="mt-2 typo-body-02-regular text-gray-04">
        무료 혜택 종료 시점: {formatKst(freeAccessEndsAt)} (한국 시각)
      </p>
      <p className="mt-6 typo-body-02-regular text-gray-04">
        결제(코페이) 연동이 완료되면 이 페이지에서 등록할 수 있습니다. 준비 중입니다.
      </p>
    </div>
  );
}
