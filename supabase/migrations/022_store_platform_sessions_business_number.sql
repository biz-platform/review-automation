-- 플랫폼별 연동 시 사용한 사업자 등록번호 (매장 관리 페이지 표시용)
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS business_registration_number TEXT;

COMMENT ON COLUMN store_platform_sessions.business_registration_number IS '해당 플랫폼 연동 시 등록된 사업자 등록번호 (플랫폼마다 상이할 수 있음)';
