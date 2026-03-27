-- 배민 다매장: 리뷰가 속한 플랫폼 점포 ID(예: 배민 shopNo). 답글 등록·수정·삭제 시 URL 컨텍스트용.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS platform_shop_external_id TEXT;

ALTER TABLE reviews_archive
  ADD COLUMN IF NOT EXISTS platform_shop_external_id TEXT;

COMMENT ON COLUMN reviews.platform_shop_external_id IS '플랫폼 점포 식별자. 배민: self.baemin.com /shops/{shopNo}/reviews 의 shopNo.';

-- 기존 배민 리뷰: 연동 세션의 대표 external_shop_id로 백필
UPDATE reviews r
SET platform_shop_external_id = trim(s.external_shop_id)
FROM store_platform_sessions s
WHERE r.store_id = s.store_id
  AND r.platform = 'baemin'::platform_enum
  AND s.platform = 'baemin'
  AND r.platform_shop_external_id IS NULL
  AND s.external_shop_id IS NOT NULL
  AND trim(s.external_shop_id) <> '';

-- archive_old_reviews: platform_shop_external_id 포함
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

  INSERT INTO reviews_archive (
    id,
    store_id,
    platform,
    external_id,
    rating,
    content,
    author_name,
    written_at,
    created_at,
    archived_at,
    images,
    menus,
    platform_shop_external_id
  )
  SELECT
    id,
    store_id,
    platform,
    external_id,
    rating,
    content,
    author_name,
    written_at,
    created_at,
    now(),
    COALESCE(images, '[]'),
    COALESCE(menus, '[]'),
    platform_shop_external_id
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
    menus = EXCLUDED.menus,
    platform_shop_external_id = EXCLUDED.platform_shop_external_id;

  GET DIAGNOSTICS archived = ROW_COUNT;

  DELETE FROM reviews WHERE written_at IS NOT NULL AND written_at < cutoff;
  GET DIAGNOSTICS deleted = ROW_COUNT;

  RETURN QUERY SELECT archived, deleted;
END;
$$;
