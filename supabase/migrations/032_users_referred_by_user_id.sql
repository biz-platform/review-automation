-- 셀러 영업 링크(?ref=코드)로 가입한 하위 고객 연결
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_referred_by_user_id
  ON public.users (referred_by_user_id)
  WHERE referred_by_user_id IS NOT NULL;

COMMENT ON COLUMN public.users.referred_by_user_id IS '가입 시 사용한 셀러 영업 링크의 소유자(users.id). 하위 고객 목록 조회용';
