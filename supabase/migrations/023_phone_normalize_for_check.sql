-- 휴대번호 중복 검사 시 DB 저장값(E.164)과 사용자 입력(010...) 형식 차이로 검증 실패하는 문제 방지.
-- 비교 전 양쪽을 동일한 E.164 형식으로 정규화.

CREATE OR REPLACE FUNCTION public.normalize_phone_to_e164(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN
    RETURN NULL;
  END IF;
  d := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');
  IF length(d) = 0 THEN
    RETURN NULL;
  END IF;
  IF left(d, 2) = '82' THEN
    RETURN '+' || left(d, 12);
  END IF;
  IF left(d, 1) = '0' THEN
    RETURN '+82' || substring(d from 2 for 10);
  END IF;
  RETURN '+82' || left(d, 10);
END;
$$;

COMMENT ON FUNCTION public.normalize_phone_to_e164(text) IS '한국 휴대번호를 E.164(+8210...) 형식으로 정규화. availability/중복 검사용.';

CREATE OR REPLACE FUNCTION public.check_auth_phone_exists(p_phone text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE normalize_phone_to_e164(phone) = normalize_phone_to_e164(p_phone)
      AND deleted_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.check_auth_phone_exists(text) IS '가입 전 휴대번호 중복 여부. auth.users 기준. 입력/DB 값 모두 E.164로 정규화 후 비교.';
