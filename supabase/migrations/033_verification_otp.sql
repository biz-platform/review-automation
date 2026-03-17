-- 서버리스(다중 인스턴스) 환경에서 인증번호 공유용. API에서만 service role로 접근.
CREATE TABLE IF NOT EXISTS public.verification_otp (
  identifier TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  last_sent_at TIMESTAMPTZ,
  sent_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.verification_otp IS '이메일/휴대전화 인증번호. 발송·검증 시 인스턴스 간 공유용(프로덕션)';

-- RLS 비활성: 서버(service role)만 접근
ALTER TABLE public.verification_otp ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.verification_otp
  FOR ALL
  USING (false)
  WITH CHECK (false);
