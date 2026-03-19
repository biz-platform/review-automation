-- admin_list_customers 반환에 is_seller 추가 (어드민 고객 관리 셀러 등록 컬럼용)
-- 반환 타입 변경 시 CREATE OR REPLACE 불가 → 기존 함수 제거 후 재생성

DROP FUNCTION IF EXISTS public.admin_list_customers(integer, integer, text, text);

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
  is_seller boolean,
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
      u.is_seller,
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
