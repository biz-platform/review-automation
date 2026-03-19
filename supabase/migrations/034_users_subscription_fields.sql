-- public.users에 월 구독 결제 정보를 추가한다.
-- center_manager는 별도 결제 없이도 유료 기능을 계속 사용할 수 있으므로 paid_at/paid_until이 비어 있을 수 있다.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS paid_until TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.users.is_admin IS '어드민 전용 권한. role과 별도 운영자 권한';
COMMENT ON COLUMN public.users.paid_at IS '월 구독 결제 시각. center_manager는 NULL 가능';
COMMENT ON COLUMN public.users.paid_until IS '월 구독 만료 시각. center_manager는 NULL 가능';

CREATE INDEX IF NOT EXISTS idx_users_role_created_at
  ON public.users (role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_paid_until
  ON public.users (paid_until)
  WHERE paid_until IS NOT NULL;

CREATE OR REPLACE FUNCTION public.admin_list_customers(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_keyword text DEFAULT '',
  p_member_type text DEFAULT 'all'
)
RETURNS TABLE (
  id uuid,
  email text,
  phone text,
  role public.user_role,
  paid_at timestamptz,
  paid_until timestamptz,
  created_at timestamptz,
  billing_state text,
  total_count bigint
)
LANGUAGE sql
STABLE
AS $$
  WITH filtered AS (
    SELECT
      u.id,
      u.email,
      u.phone,
      u.role,
      u.paid_at,
      u.paid_until,
      u.created_at,
      CASE
        WHEN u.role = 'center_manager' THEN 'exempt'
        WHEN u.role = 'member' AND u.paid_until IS NOT NULL AND u.paid_until >= now() THEN 'active'
        WHEN u.role = 'member' AND (u.paid_until IS NULL OR u.paid_until < now()) THEN 'unpaid'
        WHEN u.role = 'planner' AND u.paid_until IS NOT NULL AND u.paid_until >= now() THEN 'active'
        WHEN u.role = 'planner' AND u.paid_until IS NULL THEN 'unpaid'
        WHEN u.role = 'planner' THEN 'expired'
        ELSE 'unpaid'
      END AS billing_state
    FROM public.users u
    WHERE
      (
        p_keyword = ''
        OR u.email ILIKE '%' || p_keyword || '%'
        OR u.phone ILIKE '%' || p_keyword || '%'
      )
      AND (
        p_member_type = 'all'
        OR (p_member_type = 'center_manager' AND u.role = 'center_manager')
        OR (p_member_type = 'planner' AND u.role = 'planner')
        OR (
          p_member_type = 'paid_member'
          AND u.role = 'member'
          AND u.paid_until IS NOT NULL
          AND u.paid_until >= now()
        )
        OR (
          p_member_type = 'free_member'
          AND u.role = 'member'
          AND (u.paid_until IS NULL OR u.paid_until < now())
        )
      )
  )
  SELECT
    filtered.*,
    count(*) OVER() AS total_count
  FROM filtered
  ORDER BY created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;
