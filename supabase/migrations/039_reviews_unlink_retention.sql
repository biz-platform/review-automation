-- 플랫폼 연동 해제 시 해당 매장·플랫폼의 reviews / reviews_archive 를
-- 30일간 조회 가능하도록 스냅샷 보관 후 기존과 같이 원본 행 삭제.
-- 만료 행은 purge_expired_reviews_unlink_retention() 로 정리 (크론·수동 호출).

CREATE TABLE reviews_unlink_retention (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_review_id UUID NOT NULL,
  source_kind TEXT NOT NULL CHECK (source_kind IN ('active', 'archive')),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  external_id TEXT,
  rating INTEGER,
  content TEXT,
  author_name TEXT,
  written_at TIMESTAMPTZ,
  original_created_at TIMESTAMPTZ NOT NULL,
  images JSONB,
  menus JSONB,
  platform_reply_content TEXT,
  platform_reply_id TEXT,
  archived_at TIMESTAMPTZ,
  unlinked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  retain_until TIMESTAMPTZ NOT NULL,
  reply_draft_snapshot JSONB,
  UNIQUE(source_review_id, source_kind)
);

CREATE INDEX idx_reviews_unlink_retention_store_platform
  ON reviews_unlink_retention(store_id, platform);
CREATE INDEX idx_reviews_unlink_retention_retain_until
  ON reviews_unlink_retention(retain_until);

COMMENT ON TABLE reviews_unlink_retention IS '연동 해제 시 리뷰 스냅샷. retain_until 이후 purge 함수로 삭제.';
COMMENT ON COLUMN reviews_unlink_retention.source_kind IS 'active: reviews 테이블 출처, archive: reviews_archive 출처';
COMMENT ON COLUMN reviews_unlink_retention.reply_draft_snapshot IS '연동 해제 시점 reply_drafts 요약(JSON).';

ALTER TABLE reviews_unlink_retention ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read unlink retention of own stores"
  ON reviews_unlink_retention FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM stores s
      WHERE s.id = reviews_unlink_retention.store_id AND s.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION cascade_delete_on_session_unlink()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_retain_until timestamptz := now() + interval '30 days';
BEGIN
  -- 활성 리뷰 + 당시 초안 스냅샷
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
  WHERE r.store_id = OLD.store_id
    AND r.platform = OLD.platform::platform_enum;

  -- 아카이브(오래된 리뷰). archive 테이블에는 platform_reply 컬럼 없음 → NULL
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
  WHERE a.store_id = OLD.store_id
    AND a.platform = OLD.platform::platform_enum;

  DELETE FROM reviews
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform::platform_enum;

  DELETE FROM reviews_archive
  WHERE store_id = OLD.store_id
    AND platform = OLD.platform::platform_enum;

  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION cascade_delete_on_session_unlink() IS '연동 해제 시 리뷰·아카이브를 30일 스냅샷으로 복사 후 원본 삭제';

CREATE OR REPLACE FUNCTION purge_expired_reviews_unlink_retention()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n bigint;
BEGIN
  DELETE FROM reviews_unlink_retention
  WHERE retain_until < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

COMMENT ON FUNCTION purge_expired_reviews_unlink_retention() IS 'retain_until 경과한 연동 해제 스냅샷 삭제. service role / 크론에서 호출.';

REVOKE ALL ON FUNCTION purge_expired_reviews_unlink_retention() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_expired_reviews_unlink_retention() TO service_role;
