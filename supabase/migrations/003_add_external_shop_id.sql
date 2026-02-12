-- 플랫폼별 가게 고유번호 (예: 배민 셀프서비스 /shops/14680344/reviews 의 14680344)
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS external_shop_id TEXT;

COMMENT ON COLUMN store_platform_sessions.external_shop_id IS '플랫폼에서 부여한 가게 고유번호 (배민: /shops/{id}/reviews 의 id)';
