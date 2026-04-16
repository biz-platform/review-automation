-- 리뷰별 키워드(감성). 대시보드 리뷰 분석 탭 C 영역 집계용.
-- 실제 키워드 매핑은 별도 배치/동기화에서 채움.

CREATE TABLE review_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_keywords_review_keyword_unique UNIQUE (review_id, keyword)
);

CREATE INDEX idx_review_keywords_review_id ON review_keywords(review_id);
CREATE INDEX idx_review_keywords_sentiment ON review_keywords(sentiment);

COMMENT ON TABLE review_keywords IS '리뷰 키워드 및 감성(positive/negative). 대시보드 키워드 분석용.';
COMMENT ON COLUMN review_keywords.sentiment IS 'positive: 긍정, negative: 개선 필요';

ALTER TABLE review_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read keywords of own store reviews"
  ON review_keywords FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM reviews r
      JOIN stores s ON s.id = r.store_id
      WHERE r.id = review_keywords.review_id
        AND s.user_id = auth.uid()
    )
  );
