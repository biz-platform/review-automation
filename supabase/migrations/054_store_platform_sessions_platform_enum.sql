-- store_platform_sessions.platform 을 TEXT → platform_enum 으로 통일 (reviews / store_platform_shops 와 정합).
-- 연동 해제 RPC·세션 삭제 트리거는 enum 비교로 정리.

ALTER TABLE store_platform_sessions
  ALTER COLUMN platform DROP DEFAULT;

ALTER TABLE store_platform_sessions
  ALTER COLUMN platform TYPE public.platform_enum
  USING platform::public.platform_enum;

ALTER TABLE store_platform_sessions
  ALTER COLUMN platform SET DEFAULT 'baemin'::public.platform_enum;

COMMENT ON COLUMN store_platform_sessions.platform IS '연동 플랫폼 코드 (public.platform_enum).';

-- 세션 행 삭제 시 리뷰/아카이브 CASCADE (025): 컬럼이 enum 이므로 캐스팅 제거
CREATE OR REPLACE FUNCTION cascade_delete_on_session_unlink()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM reviews
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform;

  DELETE FROM reviews_archive
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform;

  RETURN OLD;
END;
$$;

-- 042 RPC: 세션 삭제 시 platform 은 이제 platform_enum — text 캐스팅 제거
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
  n_active_1 bigint;
  n_active_2 bigint;
  n_archive_1 bigint;
  n_archive_2 bigint;
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
    x.id,
    'active',
    x.store_id,
    x.platform,
    x.external_id,
    x.rating,
    x.content,
    x.author_name,
    x.written_at,
    x.created_at,
    x.images,
    x.menus,
    x.platform_reply_content,
    x.platform_reply_id,
    NULL,
    now(),
    v_retain_until,
    x.reply_draft_snapshot
  FROM (
    SELECT DISTINCT ON (r.store_id, r.platform, r.external_id)
      r.id,
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
      ) AS reply_draft_snapshot
    FROM reviews r
    WHERE r.store_id = p_store_id
      AND r.platform = v_platform
      AND r.external_id IS NOT NULL
      AND length(trim(r.external_id)) > 0
    ORDER BY r.store_id, r.platform, r.external_id, r.created_at DESC
  ) x
  ON CONFLICT (store_id, platform, external_id)
  WHERE external_id IS NOT NULL AND length(trim(external_id)) > 0
  DO UPDATE SET
    source_review_id = EXCLUDED.source_review_id,
    source_kind = EXCLUDED.source_kind,
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    author_name = EXCLUDED.author_name,
    written_at = EXCLUDED.written_at,
    original_created_at = EXCLUDED.original_created_at,
    images = EXCLUDED.images,
    menus = EXCLUDED.menus,
    platform_reply_content = EXCLUDED.platform_reply_content,
    platform_reply_id = EXCLUDED.platform_reply_id,
    archived_at = EXCLUDED.archived_at,
    unlinked_at = EXCLUDED.unlinked_at,
    retain_until = EXCLUDED.retain_until,
    reply_draft_snapshot = EXCLUDED.reply_draft_snapshot;

  GET DIAGNOSTICS n_active_1 = ROW_COUNT;

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
    AND r.platform = v_platform
    AND (r.external_id IS NULL OR length(trim(r.external_id)) = 0);

  GET DIAGNOSTICS n_active_2 = ROW_COUNT;
  n_active := coalesce(n_active_1, 0) + coalesce(n_active_2, 0);

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
    x.id,
    'archive',
    x.store_id,
    x.platform,
    x.external_id,
    x.rating,
    x.content,
    x.author_name,
    x.written_at,
    x.created_at,
    x.images,
    x.menus,
    NULL,
    NULL,
    x.archived_at,
    now(),
    v_retain_until,
    NULL
  FROM (
    SELECT DISTINCT ON (a.store_id, a.platform, a.external_id)
      a.id,
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
      a.archived_at
    FROM reviews_archive a
    WHERE a.store_id = p_store_id
      AND a.platform = v_platform
      AND a.external_id IS NOT NULL
      AND length(trim(a.external_id)) > 0
    ORDER BY a.store_id, a.platform, a.external_id, a.created_at DESC
  ) x
  ON CONFLICT (store_id, platform, external_id)
  WHERE external_id IS NOT NULL AND length(trim(external_id)) > 0
  DO UPDATE SET
    source_review_id = EXCLUDED.source_review_id,
    source_kind = EXCLUDED.source_kind,
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    author_name = EXCLUDED.author_name,
    written_at = EXCLUDED.written_at,
    original_created_at = EXCLUDED.original_created_at,
    images = EXCLUDED.images,
    menus = EXCLUDED.menus,
    platform_reply_content = EXCLUDED.platform_reply_content,
    platform_reply_id = EXCLUDED.platform_reply_id,
    archived_at = EXCLUDED.archived_at,
    unlinked_at = EXCLUDED.unlinked_at,
    retain_until = EXCLUDED.retain_until,
    reply_draft_snapshot = EXCLUDED.reply_draft_snapshot;

  GET DIAGNOSTICS n_archive_1 = ROW_COUNT;

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
    AND a.platform = v_platform
    AND (a.external_id IS NULL OR length(trim(a.external_id)) = 0);

  GET DIAGNOSTICS n_archive_2 = ROW_COUNT;
  n_archive := coalesce(n_archive_1, 0) + coalesce(n_archive_2, 0);

  DELETE FROM reviews
  WHERE store_id = p_store_id AND platform = v_platform;

  DELETE FROM reviews_archive
  WHERE store_id = p_store_id AND platform = v_platform;

  DELETE FROM store_platform_sessions
  WHERE store_id = p_store_id AND platform = v_platform;

  GET DIAGNOSTICS n_session = ROW_COUNT;

  RETURN jsonb_build_object(
    'retention_rows_active', n_active,
    'retention_rows_archive', n_archive,
    'session_rows_deleted', n_session
  );
END;
$$;

COMMENT ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) IS
  '연동 해제: 리뷰·아카이브 스냅샷(동일 external_id upsert) 후 원본·세션 삭제. store_platform_sessions.platform 은 platform_enum.';

REVOKE ALL ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unlink_platform_session_with_review_snapshot(uuid, text) TO service_role;
