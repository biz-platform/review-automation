-- AI 댓글 길이: short(약 100자), normal(약 200자), long(250자 이상)
ALTER TABLE tone_settings
  ADD COLUMN IF NOT EXISTS comment_length TEXT NOT NULL DEFAULT 'normal';

COMMENT ON COLUMN tone_settings.comment_length IS 'short | normal | long';

-- tone 기본값을 default(기본 말투)로 통일. 기존 friendly/formal/casual 호환
ALTER TABLE tone_settings
  ALTER COLUMN tone SET DEFAULT 'default';

COMMENT ON COLUMN tone_settings.tone IS 'default | female_2030 | male_2030 | senior_4050 (legacy: friendly, formal, casual)';
