-- 리뷰 시 주문 메뉴명 목록 (배민 menus[].name 등). JSONB: ["메뉴1", "메뉴2"]
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS menus JSONB DEFAULT '[]';

ALTER TABLE reviews_archive
  ADD COLUMN IF NOT EXISTS menus JSONB DEFAULT '[]';

COMMENT ON COLUMN reviews.menus IS '주문 메뉴명 배열. e.g. ["꼬들족발(차가운족발)"]';

-- archive_old_reviews: menus 컬럼 포함
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

  INSERT INTO reviews_archive (id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, archived_at, images, menus)
  SELECT id, store_id, platform, external_id, rating, content, author_name, written_at, created_at, now(), COALESCE(images, '[]'), COALESCE(menus, '[]')
  FROM reviews
  WHERE written_at IS NOT NULL AND written_at < cutoff
  ON CONFLICT (store_id, platform, external_id) DO UPDATE SET
    rating = EXCLUDED.rating,
    content = EXCLUDED.content,
    author_name = EXCLUDED.author_name,
    written_at = EXCLUDED.written_at,
    created_at = EXCLUDED.created_at,
    archived_at = now(),
    images = EXCLUDED.images,
    menus = EXCLUDED.menus;

  GET DIAGNOSTICS archived = ROW_COUNT;

  DELETE FROM reviews WHERE written_at IS NOT NULL AND written_at < cutoff;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN QUERY SELECT archived, deleted;
END;
$$;
