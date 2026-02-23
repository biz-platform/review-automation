-- 플랫폼별 연동 매장 카테고리 (예: 배민 "족발·보쌈")
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS shop_category TEXT;

COMMENT ON COLUMN store_platform_sessions.shop_category IS '플랫폼 매장 업종/카테고리 (배민: 리뷰 페이지 select option에서 추출)';
