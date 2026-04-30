-- 요금제 변경 예약(다운그레이드) 및 적용 시점 추적
-- NOTE: RLS로 클라이언트 직접 UPDATE 불가 → Next Route Handler는 service role로 갱신

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS billing_pending_plan_key text NULL,
  ADD COLUMN IF NOT EXISTS billing_pending_plan_effective_at timestamptz NULL;

COMMENT ON COLUMN public.users.billing_pending_plan_key IS
  '다음 청구 주기부터 적용될 요금제 키(예: pro). NULL이면 예약 없음';

COMMENT ON COLUMN public.users.billing_pending_plan_effective_at IS
  'billing_pending_plan_key가 실제로 적용되는 시각(일반적으로 paid_until과 동일한 “다음 주기 시작” 시각)';

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_billing_pending_plan_key_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_billing_pending_plan_key_check
  CHECK (
    billing_pending_plan_key IS NULL
    OR billing_pending_plan_key IN ('pro', 'premium')
  );

CREATE INDEX IF NOT EXISTS idx_users_billing_pending_plan_key
  ON public.users (billing_pending_plan_key)
  WHERE billing_pending_plan_key IS NOT NULL;
