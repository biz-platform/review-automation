-- 앱 전용 프로필·권한 테이블. auth.users는 Supabase 관리, 등급/셀러 여부는 public.users에서 관리.
-- 설계: docs/design-public-users-and-auth.md

CREATE TYPE public.user_role AS ENUM ('member', 'center_manager', 'planner');

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  role public.user_role NOT NULL DEFAULT 'member',
  is_seller BOOLEAN NOT NULL DEFAULT false,
  dbtalk_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS '앱 전용 프로필·권한. auth.users와 1:1. 등급(일반/센터장/플래너), 셀러 여부, DBtalk 인증 시각';
COMMENT ON COLUMN public.users.role IS 'member: 일반 회원, center_manager: 센터장(DBtalk 인증), planner: 플래너(CS 확인 후 권한 부여)';
COMMENT ON COLUMN public.users.is_seller IS '셀러 권한. 센터장 인증 시 true, 플래너는 어드민에서 부여';
COMMENT ON COLUMN public.users.dbtalk_verified_at IS 'DBtalk 인증 완료 시각';

CREATE UNIQUE INDEX idx_users_email ON public.users(lower(trim(email))) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_users_phone ON public.users(trim(phone)) WHERE phone IS NOT NULL;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- INSERT/UPDATE/DELETE는 service_role 또는 백엔드 전용. 정책 없음 = anon/authenticated 불가
