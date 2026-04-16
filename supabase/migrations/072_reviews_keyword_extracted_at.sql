-- 리뷰 키워드 Gemini 추출 완료 표시(본문 있는 리뷰만 대상). 키워드 0건이어도 재시도 루프 방지용.

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS keyword_extracted_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN reviews.keyword_extracted_at IS
  '배달 리뷰 본문 키워드(Gemini) 추출 처리 시각. 성공·빈 키워드 모두 완료 시 갱신.';

CREATE INDEX IF NOT EXISTS idx_reviews_store_keyword_extracted
  ON reviews (store_id, keyword_extracted_at)
  WHERE keyword_extracted_at IS NULL;
