-- 결제 관리: 카드 마스킹 표시용 + 청구 이력 테이블

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS payment_card_bin4 text NULL,
  ADD COLUMN IF NOT EXISTS payment_card_last4 text NULL;

COMMENT ON COLUMN public.users.payment_card_bin4 IS '카드 앞 4자리(표시 마스킹 NNNN-****-****-NNNN)';
COMMENT ON COLUMN public.users.payment_card_last4 IS '카드 뒤 4자리';

CREATE TABLE IF NOT EXISTS public.member_billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_code text NOT NULL,
  plan_name text NOT NULL DEFAULT '프리미엄 요금제',
  paid_at timestamptz NOT NULL,
  usage_period_start timestamptz NOT NULL,
  usage_period_end timestamptz NOT NULL,
  amount_won integer NOT NULL CHECK (amount_won >= 0),
  payment_status text NOT NULL CHECK (payment_status IN ('completed', 'error')),
  usage_status text NOT NULL CHECK (usage_status IN ('active', 'suspended', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_billing_invoice_code_per_user UNIQUE (user_id, invoice_code)
);

CREATE INDEX IF NOT EXISTS idx_member_billing_invoices_user_paid_at
  ON public.member_billing_invoices (user_id, paid_at DESC);

COMMENT ON TABLE public.member_billing_invoices IS '구독 청구 이력(결제 관리)';

ALTER TABLE public.member_billing_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own billing invoices" ON public.member_billing_invoices;

CREATE POLICY "Users can read own billing invoices"
  ON public.member_billing_invoices
  FOR SELECT
  USING (auth.uid() = user_id);
