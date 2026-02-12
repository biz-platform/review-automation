-- 배민 셀프서비스 프로필 API 응답의 사장님 고유번호 (self-api.baemin.com/v1/session/profile → shopOwnerNumber)
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS shop_owner_number TEXT;

COMMENT ON COLUMN store_platform_sessions.shop_owner_number IS '배민 셀프서비스 프로필 API의 shopOwnerNumber (사장님 고유번호)';
