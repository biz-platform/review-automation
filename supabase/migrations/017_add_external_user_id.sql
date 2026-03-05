-- 땡겨요 수정/삭제 API에 필요한 로그인 유저 ID (fin_chg_id) 저장
ALTER TABLE store_platform_sessions
  ADD COLUMN IF NOT EXISTS external_user_id TEXT;
COMMENT ON COLUMN store_platform_sessions.external_user_id IS '플랫폼 로그인 유저 ID (땡겨요: requestUpdateReview/requestDeleteReview 의 fin_chg_id)';
