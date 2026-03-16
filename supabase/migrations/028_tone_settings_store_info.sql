-- 매장 정보(댓글 작성 정보): 업종, 주요 고객층. AI 댓글 생성 시 참고용
ALTER TABLE tone_settings
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS customer_segment TEXT;

COMMENT ON COLUMN tone_settings.industry IS '업종 예) 소고기, 해산물, 카페';
COMMENT ON COLUMN tone_settings.customer_segment IS '주요 고객층 예) 직장인 점심, 가성비, 프리미엄';
