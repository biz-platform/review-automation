-- 가입 전 이메일/휴대번호 중복 검사용. auth.users 조회는 service_role 또는 DEFINER로만 가능.
-- API에서 service_role 클라이언트로 RPC 호출.

CREATE OR REPLACE FUNCTION public.check_auth_email_exists(p_email text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE lower(trim(email)) = lower(trim(p_email))
      AND deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.check_auth_email_exists(text) IS '가입 전 이메일 중복 여부. auth.users 기준.';

CREATE OR REPLACE FUNCTION public.check_auth_phone_exists(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE trim(phone) = trim(p_phone)
      AND deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.check_auth_phone_exists(text) IS '가입 전 휴대번호 중복 여부. auth.users 기준. E.164 등 동일 형식으로 전달해야 함.';
