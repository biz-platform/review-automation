-- 연동 시 ID/PW 암호화 저장 (browser_jobs.payload에 평문 저장 방지)
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS credentials_encrypted TEXT;

COMMENT ON COLUMN store_platform_sessions.credentials_encrypted IS '플랫폼 로그인 자격증명 암호화 (배민 등). 리뷰 동기화 시 신규 로그인에 사용.';
