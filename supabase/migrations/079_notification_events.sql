-- 알림(알림톡 등) 중복 발송 방지/추적용 이벤트 로그

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'sent', 'error')),
  user_id uuid NULL REFERENCES public.users(id) ON DELETE SET NULL,
  store_id uuid NULL REFERENCES public.stores(id) ON DELETE SET NULL,
  review_id uuid NULL REFERENCES public.reviews(id) ON DELETE SET NULL,
  invoice_id uuid NULL REFERENCES public.member_billing_invoices(id) ON DELETE SET NULL,
  recipient_phone text NULL,
  error_message text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_events_dedupe_key
  ON public.notification_events (dedupe_key);

CREATE INDEX IF NOT EXISTS idx_notification_events_type_status_created_at
  ON public.notification_events (event_type, status, created_at DESC);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

-- 기본은 RLS만 켜고 정책은 두지 않는다(서비스 롤에서만 접근).

