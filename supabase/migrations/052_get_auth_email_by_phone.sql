-- 아이디 찾기: 휴대폰 OTP 검증 후 auth.users에서 이메일 조회 (service_role 전용 RPC)

CREATE OR REPLACE FUNCTION public.get_auth_email_by_phone_e164(p_phone text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT trim(u.email::text)
  FROM auth.users u
  WHERE public.normalize_phone_to_e164(u.phone) = public.normalize_phone_to_e164(p_phone)
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_auth_email_by_phone_e164(text) IS '아이디 찾기용. E.164 정규화된 휴대번호로 가입 이메일 조회.';
