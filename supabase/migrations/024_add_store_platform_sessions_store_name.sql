-- 플랫폼별로 매장명이 다를 수 있으므로, 연동 시 해당 플랫폼에서 보이는 매장명 저장.
-- null이면 stores.name 사용 (기존 동작).

ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS store_name TEXT;

COMMENT ON COLUMN store_platform_sessions.store_name IS '플랫폼에서 보이는 매장명. null이면 stores.name 사용.';
