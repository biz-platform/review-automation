import { ButtonLink } from "@/components/ui/button";

/** P-01 결제정보(수정) — PG 연동 전 */
export function BillingPaymentCardShell() {
  return (
    <div className="w-full min-w-0">
      <h1 className="mb-4 typo-heading-02-bold text-gray-01">결제정보 변경</h1>
      <p className="typo-body-02-regular text-gray-04">
        카드 등록·변경(P-01)은 PG 연동 후 이 화면에서 진행할 예정입니다.
      </p>
      <ButtonLink
        href="/manage/billing/payment"
        variant="secondary"
        size="md"
        className="mt-8 inline-flex"
      >
        결제 관리로 돌아가기
      </ButtonLink>
    </div>
  );
}
