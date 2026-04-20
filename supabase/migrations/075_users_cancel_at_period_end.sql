-- 정기결제 해지 예정(현재 주기 종료 후 미갱신) — 이용 현황 해지 예정 UI (Figma 274:15201)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.users.cancel_at_period_end IS '말기까지 이용 후 자동 해지 예정. true면 해지 예정 배지·자동 해지일·해지 취소 CTA';
