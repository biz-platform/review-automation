-- 결제 건 환불 상태(어드민 결제 관리·CS 워크플로)

ALTER TABLE public.member_billing_invoices
  ADD COLUMN IF NOT EXISTS refund_status text NOT NULL DEFAULT 'none';

ALTER TABLE public.member_billing_invoices
  DROP CONSTRAINT IF EXISTS member_billing_invoices_refund_status_check;

ALTER TABLE public.member_billing_invoices
  ADD CONSTRAINT member_billing_invoices_refund_status_check
  CHECK (
    refund_status IN ('none', 'eligible', 'ineligible', 'pending', 'completed')
  );

COMMENT ON COLUMN public.member_billing_invoices.refund_status IS
  'none: 결제 오류 등 환불 대상 아님 | eligible: 환불 가능 | ineligible: 요건 미달 | pending: 환불 대기 | completed: 환불 완료';

UPDATE public.member_billing_invoices
SET refund_status = CASE
  WHEN payment_status = 'error' THEN 'none'
  ELSE 'eligible'
END
WHERE refund_status = 'none' AND payment_status IS NOT NULL;
