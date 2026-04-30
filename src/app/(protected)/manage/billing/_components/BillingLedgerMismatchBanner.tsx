"use client";

/**
 * 유료 구독(paid_until)인데 활성 member_billing_invoices 가 없을 때(시드·외부 동기화 누락).
 * 요금제 변경·업그레이드 API가 인보이스를 요구하므로 안내한다.
 */
export function BillingLedgerMismatchBanner() {
  return (
    <div
      className="mb-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 typo-body-02-regular text-amber-950"
      role="status"
    >
      <p className="typo-body-02-bold text-amber-950">구독 청구 정보가 동기화되지 않았습니다.</p>
      <p className="mt-1 typo-body-03-regular text-amber-900/90">
        결제 내역에 활성 구독 건이 보이지 않는데 유료 구독으로 표시되는 경우입니다. 요금제
        변경이 안 되거나 표시가 어긋날 수 있어요. 잠시 후 다시 확인하거나, 문제가 계속되면
        고객센터로 문의해 주세요.
      </p>
    </div>
  );
}
