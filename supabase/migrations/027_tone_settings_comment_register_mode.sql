-- 댓글 등록 방식: direct(직접 등록) | auto(자동 등록). 기본값 직접 등록
ALTER TABLE tone_settings
  ADD COLUMN IF NOT EXISTS comment_register_mode TEXT NOT NULL DEFAULT 'direct';

COMMENT ON COLUMN tone_settings.comment_register_mode IS 'direct | auto';
