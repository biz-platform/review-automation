-- 트리거 대신 앱·워커가 호출하는 RPC로 연동 해제 + 리뷰 스냅샷 + 세션 삭제를 한 트랜잭션에서 처리.
-- reviews_unlink_retention: 일반 사용자 RLS SELECT 제거 → service_role(어드민 API)만 조회.

DROP TRIGGER IF EXISTS after_store_platform_sessions_delete ON public.store_platform_sessions;
DROP FUNCTION IF EXISTS public.cascade_delete_on_session_unlink();

CREATE OR REPLACE FUNCTION public.unlink_platform_session_with_review_snapshot(
  p_store_id uuid,
  p_platform public.platform_enum
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retain_until timestamptz := now() + interval '30 days';
  n_active bigint;
  n_archive bigint;
  n_session bigint;
BEGIN
  INSERT INTO reviews_unlink_retention (
    source_review_id,
    source_kind,
    store_id,
    platform,
    external_id,
    rating,
    content,
    author_name,
    written_at,
    original_created_at,
    images,
    menus,
    platform_reply_content,
    platform_reply_id,
    archived_at,
    unlinked_at,
    retain_until,
    reply_draft_snapshot
  )
  SELECT
    r.id,
    'active',
    r.store_id,
    r.platform,
    r.external_id,
    r.rating,
    r.content,
    r.author_name,
    r.written_at,
    r.created_at,
    r.images,
    r.menus,
    r.platform_reply_content,
    r.platform_reply_id,
    NULL,
    now(),
    v_retain_until,
    (
      SELECT jsonb_build_object(
        'draft_content', d.draft_content,
        'status', d.status::text,
        'approved_content', d.approved_content,
        'approved_at', d.approved_at
      )
      FROM reply_drafts d
      WHERE d.review_id = r.id
      LIMIT 1
    )
  FROM reviews r
  WHERE r.store_id = p_store_id
    AND r.platform = p_platform;
  GET DIAGNOSTICS n_active = ROW_COUNT;

  INSERT INTO reviews_unlink_retention (
    source_review_id,
    source_kind,
    store_id,
    platform,
    external_id,
    rating,
    content,
    author_name,
    written_at,
    original_created_at,
    images,
    menus,
    platform_reply_content,
    platform_reply_id,
    archived_at,
    unlinked_at,
    retain_until,
    reply_draft_snapshot
  )
  SELECT
    a.id,
    'archive',
    a.store_id,
    a.platform,
    a.external_id,
    a.rating,
    a.content,
    a.author_name,
    a.written_at,
    a.created_at,
    a.images,
    a.menus,
    NULL,
    NULL,
    a.archived_at,
    now(),
    v_retain_until,
    NULL
  FROM reviews_archive a
  WHERE a.store_id = p_store_id
    AND a.platform = p_platform;
  GET DIAGNOSTICS n_archive = ROW_COUNT;

  DELETE FROM reviews
  WHERE store_id = p_store_id AND platform = p_platform;

  DELETE FROM reviews_archive
  WHERE store_id = p_store_id AND platform = p_platform;

  DELETE FROM store_platform_sessions
  WHERE store_id = p_store_id AND platform = p_platform;
  GET DIAGNOSTICS n_session = ROW_COUNT;

  RETURN jsonb_build_object(
    'retention_rows_active', n_active,
    'retention_rows_archive', n_archive,
    'session_rows_deleted', n_session
  );
END;
$$;

COMMENT ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, public.platform_enum) IS
  '연동 해제: 리뷰·아카이브 스냅샷 후 원본·store_platform_sessions 행 삭제. service_role 전용 호출.';

REVOKE ALL ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, public.platform_enum) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, public.platform_enum) TO service_role;

DROP POLICY IF EXISTS "Users can read unlink retention of own stores" ON public.reviews_unlink_retention;
