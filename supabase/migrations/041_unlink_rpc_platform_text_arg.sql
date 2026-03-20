-- 연동 해제 RPC 최종본 (42883 해결): PostgREST는 p_platform을 text로 넘김 → 인자는 text, 내부에서 platform_enum 캐스팅.
-- store_platform_sessions.platform 은 TEXT(002) → DELETE 시 platform = v_platform::text 필수.

DROP FUNCTION IF EXISTS public.unlink_platform_session_with_review_snapshot(uuid, public.platform_enum);

CREATE OR REPLACE FUNCTION public.unlink_platform_session_with_review_snapshot(
  p_store_id uuid,
  p_platform text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retain_until timestamptz := now() + interval '30 days';
  v_platform public.platform_enum;
  n_active bigint;
  n_archive bigint;
  n_session bigint;
BEGIN
  v_platform := p_platform::public.platform_enum;

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
    AND r.platform = v_platform;
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
    AND a.platform = v_platform;
  GET DIAGNOSTICS n_archive = ROW_COUNT;

  DELETE FROM reviews
  WHERE store_id = p_store_id AND platform = v_platform;

  DELETE FROM reviews_archive
  WHERE store_id = p_store_id AND platform = v_platform;

  -- store_platform_sessions.platform 은 TEXT 컬럼(002). enum 과 직접 비교 시 42883.
  DELETE FROM store_platform_sessions
  WHERE store_id = p_store_id AND platform = v_platform::text;
  GET DIAGNOSTICS n_session = ROW_COUNT;

  RETURN jsonb_build_object(
    'retention_rows_active', n_active,
    'retention_rows_archive', n_archive,
    'session_rows_deleted', n_session
  );
END;
$$;

COMMENT ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) IS
  '연동 해제: 리뷰·아카이브 스냅샷 후 원본·store_platform_sessions 행 삭제. service_role 전용 호출.';

REVOKE ALL ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) TO service_role;
