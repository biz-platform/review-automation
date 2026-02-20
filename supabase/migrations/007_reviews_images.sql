-- 리뷰 첨부 이미지 (배민 등). JSONB: [{ "imageUrl": "https://..." }, ...]
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

ALTER TABLE reviews_archive
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]';

COMMENT ON COLUMN reviews.images IS 'Array of { imageUrl: string }. Used by baemin and other platforms.';

-- archive_old_reviews: images 컬럼 포함하도록 갱신
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

  INSERT INTO reviews_archive (id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, archived_at, images)
  SELECT id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, now(), COALESCE(images, '[]')
  FROM reviews
  WHERE written_at IS NOT NULL AND written_at < cutoff
  ON CONFLICT (store_id, platform, external_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    author_name = EXCLUDED.author_name,
    written_at = EXCLUDED.written_at,
    created_at = EXCLUDED.created_at,
    archived_at = now(),
    images = EXCLUDED.images;

  GET DIAGNOSTICS archived = ROW_COUNT;

  DELETE FROM reviews WHERE written_at IS NOT NULL AND written_at < cutoff;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN QUERY SELECT archived, deleted;
END;
$$;
