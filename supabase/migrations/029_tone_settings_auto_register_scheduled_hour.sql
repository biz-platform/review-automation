-- 자동 등록 시 매일 실행할 시간(0~23, 서버 시간대). comment_register_mode='auto'일 때만 사용
ALTER TABLE tone_settings
  ADD COLUMN IF NOT EXISTS auto_register_scheduled_hour INTEGER;

COMMENT ON COLUMN tone_settings.auto_register_scheduled_hour IS '0-23, server hour for daily auto register (sync + reply). Used when comment_register_mode=auto';
