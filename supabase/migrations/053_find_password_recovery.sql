-- 비밀번호 찾기: 이메일+휴대폰 일치 확인, 복구 세션, OTP 검증 실패 횟수(비밀번호 찾기 전용)

CREATE OR REPLACE FUNCTION public.check_auth_phone_matches_email(p_email text, p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE lower(trim(u.email::text)) = lower(trim(p_email))
      AND u.deleted_at IS NULL
      AND public.normalize_phone_to_e164(u.phone::text) = public.normalize_phone_to_e164(p_phone)
  );
$$;

COMMENT ON FUNCTION public.check_auth_phone_matches_email(text, text) IS '비밀번호 찾기용. 가입 이메일과 휴대전화(E.164 정규화)가 동일 auth.users 행에 속하는지.';

CREATE OR REPLACE FUNCTION public.get_auth_user_id_for_password_recovery(p_email text, p_phone text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(trim(u.email::text)) = lower(trim(p_email))
    AND u.deleted_at IS NULL
    AND public.normalize_phone_to_e164(u.phone::text) = public.normalize_phone_to_e164(p_phone)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_auth_user_id_for_password_recovery(text, text) IS '비밀번호 찾기: 이메일+휴대폰 일치 시 auth.users.id 반환.';

-- 일회성 비밀번호 재설정 세션 (OTP 검증 성공 후 발급, service_role만 사용)
CREATE TABLE IF NOT EXISTS public.password_recovery_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_normalized text NOT NULL,
  phone_e164 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NULL,
  CONSTRAINT password_recovery_sessions_user_id_fk
    FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_password_recovery_sessions_user_id
  ON public.password_recovery_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_password_recovery_sessions_expires_at
  ON public.password_recovery_sessions (expires_at)
  WHERE consumed_at IS NULL;

COMMENT ON TABLE public.password_recovery_sessions IS '비밀번호 찾기: 휴대폰 OTP 검증 후 발급되는 일회성 세션.';

ALTER TABLE public.password_recovery_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "password_recovery_sessions_service_only"
  ON public.password_recovery_sessions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- 비밀번호 찾기 OTP 검증 실패 타임스탬프 (identifier = E.164 휴대폰)
CREATE TABLE IF NOT EXISTS public.otp_phone_verify_failures (
  identifier text PRIMARY KEY,
  fail_timestamps jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMENT ON TABLE public.otp_phone_verify_failures IS '휴대폰 OTP 검증 실패 시각 배열(비밀번호 찾기 등). 1시간 윈도우에서 최대 5회.';

ALTER TABLE public.otp_phone_verify_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "otp_phone_verify_failures_service_only"
  ON public.otp_phone_verify_failures
  FOR ALL
  USING (false)
  WITH CHECK (false);
