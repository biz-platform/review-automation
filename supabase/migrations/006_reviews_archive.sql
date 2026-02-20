-- reviews_archive: 180일 초과 리뷰 보관 (reviews와 동일 스키마 + archived_at)
CREATE TABLE reviews_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  external_id TEXT,
  rating INTEGER,
  content TEXT,
  author_name TEXT,
  written_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, platform, external_id)
);

CREATE INDEX idx_reviews_archive_store_id ON reviews_archive(store_id);
CREATE INDEX idx_reviews_archive_platform ON reviews_archive(platform);
CREATE INDEX idx_reviews_archive_written_at ON reviews_archive(written_at);

ALTER TABLE reviews_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read reviews_archive of own stores"
  ON reviews_archive FOR ALL
  USING (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = reviews_archive.store_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = reviews_archive.store_id AND s.user_id = auth.uid())
  );

-- RPC: written_at < (now() - 180일) 인 리뷰를 reviews_archive로 이동 후 reviews에서 삭제. service role 또는 권한 있는 호출자만 실행.
CREATE OR REPLACE FUNCTION archive_old_reviews()
RETURNS TABLE(archived_count bigint, deleted_count bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff timestamptz;
  archived bigint;
  deleted bigint;
BEGIN
  cutoff := now() - interval '180 days';

  INSERT INTO reviews_archive (id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, archived_at)
  SELECT id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, now()
  FROM reviews
  WHERE written_at IS NOT NULL AND written_at < cutoff
  ON CONFLICT (store_id, platform, external_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    author_name = EXCLUDED.author_name,
    written_at = EXCLUDED.written_at,
    created_at = EXCLUDED.created_at,
    archived_at = now();

  GET DIAGNOSTICS archived = ROW_COUNT;

  DELETE FROM reviews WHERE written_at IS NOT NULL AND written_at < cutoff;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN QUERY SELECT archived, deleted;
END;
$$;
