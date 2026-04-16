-- 리뷰 키워드 정형화(설계서 기반): canonical + alias 매핑
-- 목적:
-- - 자유 텍스트로 쌓이는 review_keywords.keyword 를 '정형 키워드'로 집계 가능하게 만들기
-- - 기존 데이터는 그대로 두고, view로 정규화 결과를 제공 (점진적 확장)

CREATE TABLE review_keyword_dictionary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentiment TEXT NOT NULL CHECK (sentiment IN ('positive', 'negative')),
  category TEXT NOT NULL CHECK (
    category IN (
      'taste',
      'quantity_price',
      'packaging_delivery',
      'revisit_recommend',
      'context'
    )
  ),
  canonical_keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_keyword_dictionary_unique UNIQUE (sentiment, canonical_keyword)
);

CREATE INDEX idx_review_keyword_dictionary_sentiment ON review_keyword_dictionary(sentiment);
CREATE INDEX idx_review_keyword_dictionary_category ON review_keyword_dictionary(category);

COMMENT ON TABLE review_keyword_dictionary IS '리뷰 키워드 정형화 사전(canonical).';
COMMENT ON COLUMN review_keyword_dictionary.sentiment IS 'positive: 긍정, negative: 개선 필요';
COMMENT ON COLUMN review_keyword_dictionary.category IS 'taste | quantity_price | packaging_delivery | revisit_recommend | context';
COMMENT ON COLUMN review_keyword_dictionary.canonical_keyword IS '정형 키워드(집계 키)';

ALTER TABLE review_keyword_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read review keyword dictionary"
  ON review_keyword_dictionary FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE review_keyword_dictionary_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dictionary_id UUID NOT NULL REFERENCES review_keyword_dictionary(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_keyword_dictionary_aliases_unique UNIQUE (alias)
);

CREATE INDEX idx_review_keyword_dictionary_aliases_dictionary_id
  ON review_keyword_dictionary_aliases(dictionary_id);

COMMENT ON TABLE review_keyword_dictionary_aliases IS '정형 키워드 alias(동의어/표현 변형) 매핑.';
COMMENT ON COLUMN review_keyword_dictionary_aliases.alias IS '원문 키워드(자유 텍스트) → canonical 매핑용';

ALTER TABLE review_keyword_dictionary_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read review keyword dictionary aliases"
  ON review_keyword_dictionary_aliases FOR SELECT
  TO authenticated
  USING (true);

-- 정규화 view: (sentiment, keyword) → (canonical_keyword, category)
-- - alias 매칭 우선, canonical 직접 일치도 허용
CREATE VIEW review_keywords_canonical AS
SELECT
  rk.id,
  rk.review_id,
  rk.keyword,
  rk.sentiment,
  rk.created_at,
  COALESCE(d_alias.canonical_keyword, d_canon.canonical_keyword, rk.keyword) AS canonical_keyword,
  COALESCE(d_alias.category, d_canon.category) AS canonical_category
FROM review_keywords rk
LEFT JOIN review_keyword_dictionary_aliases a
  ON a.alias = rk.keyword
LEFT JOIN review_keyword_dictionary d_alias
  ON d_alias.id = a.dictionary_id
LEFT JOIN review_keyword_dictionary d_canon
  ON d_canon.sentiment = rk.sentiment
 AND d_canon.canonical_keyword = rk.keyword;

COMMENT ON VIEW review_keywords_canonical IS 'review_keywords를 정형 키워드(canonical)로 매핑한 뷰.';

-- Seed (설계서 + 현재 데이터에서 바로 효율 큰 것 위주)
-- NOTE: 아래 seed는 점진적 확장용 "초기값"이며, 운영 중 계속 추가/조정 가능.
INSERT INTO review_keyword_dictionary (sentiment, category, canonical_keyword) VALUES
  -- positive / taste
  ('positive', 'taste', '맛있어요'),
  ('positive', 'taste', '간이 맞아요'),
  ('positive', 'taste', '변함없는 맛'),
  ('positive', 'taste', '고소해요'),
  ('positive', 'taste', '담백해요'),
  ('positive', 'taste', '진해요'),
  ('positive', 'taste', '시원해요'),
  ('positive', 'taste', '쫄깃해요'),
  ('positive', 'taste', '부드러워요'),
  ('positive', 'taste', '독특해요'),
  ('positive', 'taste', '바삭해요'),
  ('positive', 'taste', '신선해요'),
  ('positive', 'taste', '양념이 맛있어요'),
  ('positive', 'taste', '촉촉해요'),
  ('positive', 'taste', '매콤해요'),
  ('positive', 'taste', '잡내가 없어요'),
  ('positive', 'taste', '깔끔해요'),

  -- positive / quantity_price
  ('positive', 'quantity_price', '양 많아요'),
  ('positive', 'quantity_price', '가성비 좋아요'),
  ('positive', 'quantity_price', '구성이 알차요'),
  ('positive', 'quantity_price', '든든해요'),
  ('positive', 'quantity_price', '푸짐해요'),

  -- positive / packaging_delivery
  ('positive', 'packaging_delivery', '포장이 깔끔해요'),
  ('positive', 'packaging_delivery', '배달이 빨라요'),
  ('positive', 'packaging_delivery', '따뜻해요'),
  ('positive', 'packaging_delivery', '사진과 같아요'),
  ('positive', 'packaging_delivery', '정성이 느껴져요'),
  ('positive', 'packaging_delivery', '서비스가 좋아요'),
  ('positive', 'packaging_delivery', '친절해요'),
  ('positive', 'packaging_delivery', '요청사항 반영'),

  -- positive / revisit_recommend
  ('positive', 'revisit_recommend', '재주문 예정'),
  ('positive', 'revisit_recommend', '단골'),
  ('positive', 'revisit_recommend', '추천해요'),

  -- positive / context
  ('positive', 'context', '해장'),
  ('positive', 'context', '혼밥'),
  ('positive', 'context', '가족'),
  ('positive', 'context', '친구'),
  ('positive', 'context', '아이'),
  ('positive', 'context', '어른들'),
  ('positive', 'context', '안주'),
  ('positive', 'context', '야식'),
  ('positive', 'context', '회식'),
  ('positive', 'context', '파티'),
  ('positive', 'context', '야근'),
  ('positive', 'context', '추운 날'),
  ('positive', 'context', '더운 날'),
  ('positive', 'context', '기분 전환'),

  -- negative / taste
  ('negative', 'taste', '맛이 없어요'),
  ('negative', 'taste', '짜요'),
  ('negative', 'taste', '싱거워요'),
  ('negative', 'taste', '느끼해요'),
  ('negative', 'taste', '퍼졌어요'),
  ('negative', 'taste', '비려요'),
  ('negative', 'taste', '맛이 달라졌어요'),
  ('negative', 'taste', '질겨요'),
  ('negative', 'taste', '위생 문제'),
  ('negative', 'taste', '이물질'),
  ('negative', 'taste', '눅눅해요'),
  ('negative', 'taste', '딱딱해요'),
  ('negative', 'taste', '간이 안 맞아요'),
  ('negative', 'taste', '덜 익었어요'),
  ('negative', 'taste', '매워요'),
  ('negative', 'taste', '상했어요'),
  ('negative', 'taste', '퍽퍽해요'),
  ('negative', 'taste', '탔어요'),
  ('negative', 'taste', '끈적해요'),
  ('negative', 'taste', '냄새가 안 좋아요'),

  -- negative / quantity_price
  ('negative', 'quantity_price', '양이 적어요'),
  ('negative', 'quantity_price', '비싸요'),
  ('negative', 'quantity_price', '부실해요'),

  -- negative / packaging_delivery
  ('negative', 'packaging_delivery', '포장 불량'),
  ('negative', 'packaging_delivery', '배달 지연'),
  ('negative', 'packaging_delivery', '메뉴 누락'),
  ('negative', 'packaging_delivery', '오배송'),
  ('negative', 'packaging_delivery', '불친절'),
  ('negative', 'packaging_delivery', '식었어요'),
  ('negative', 'packaging_delivery', '녹았어요'),
  ('negative', 'packaging_delivery', '불었어요'),
  ('negative', 'packaging_delivery', '요청사항 누락'),
  ('negative', 'packaging_delivery', '사진과 달라요'),
  ('negative', 'packaging_delivery', '수저 누락'),
  ('negative', 'packaging_delivery', '리뷰이벤트 누락'),

  -- negative / revisit_recommend
  ('negative', 'revisit_recommend', '재주문 안해요'),
  ('negative', 'revisit_recommend', '실망'),
  ('negative', 'revisit_recommend', '비추해요'),
  ('negative', 'revisit_recommend', '아쉬워요'),
  ('negative', 'revisit_recommend', '옵션 추가 요청')
ON CONFLICT DO NOTHING;

-- alias seed: 실제 수집 키워드 top 변형을 canonical로 흡수
INSERT INTO review_keyword_dictionary_aliases (dictionary_id, alias)
SELECT d.id, x.alias
FROM (
  VALUES
    -- positive/taste: 맛있어요
    ('positive','맛있어요','맛있음'),
    ('positive','맛있어요','맛있습니다'),
    ('positive','맛있어요','맛있었어요'),
    ('positive','맛있어요','너무 맛있음'),
    ('positive','맛있어요','항상 맛있음'),
    ('positive','맛있어요','매우 맛있음'),
    ('positive','맛있어요','정말 맛있음'),
    ('positive','맛있어요','진짜 맛있음'),
    ('positive','맛있어요','최고의 맛'),
    ('positive','맛있어요','뛰어난 맛'),
    ('positive','맛있어요','훌륭한 맛'),
    ('positive','맛있어요','맛있게 잘 먹음'),
    ('positive','맛있어요','맛있게 먹음'),
    ('positive','맛있어요','맛있게 잘 먹었습니다'),
    ('positive','맛있어요','맛있게 잘먹었습니다'),
    ('positive','맛있어요','잘 먹었습니다'),

    -- positive/quantity_price: 양 많아요
    ('positive','양 많아요','푸짐한 양'),
    ('positive','양 많아요','넉넉한 양'),

    -- positive/packaging_delivery: 배달이 빨라요
    ('positive','배달이 빨라요','빠른 배달'),
    ('positive','배달이 빨라요','배달 빠름'),

    -- positive/revisit_recommend: 재주문 예정
    ('positive','재주문 예정','재주문 의사'),
    ('positive','재주문 예정','재주문 의사 있음'),
    ('positive','재주문 예정','재주문'),
    ('positive','재주문 예정','재주문 완료'),
    ('positive','재주문 예정','재방문 의사'),

    -- negative/packaging_delivery: 배달 지연
    ('negative','배달 지연','느린 배달'),
    ('negative','배달 지연','배달 50분 소요'),
    ('negative','배달 지연','안내 문자 지연'),
    ('negative','배달 지연','예상시간 불일치'),

    -- negative/quantity_price: 양이 적어요
    ('negative','양이 적어요','양이 적음'),
    ('negative','양이 적어요','적은 양'),
    ('negative','양이 적어요','부족한 양'),
    ('negative','양이 적어요','아쉬운 양'),
    ('negative','양이 적어요','양은 아쉬움'),
    ('negative','양이 적어요','양에 대한 아쉬움'),
    ('negative','양이 적어요','양은 조금 부족'),

    -- negative/packaging_delivery: 메뉴 누락
    ('negative','메뉴 누락','구성 누락'),
    ('negative','메뉴 누락','구성품 누락'),
    ('negative','메뉴 누락','추가 메뉴 누락'),
    ('negative','메뉴 누락','토핑 누락'),
    ('negative','메뉴 누락','음료 누락'),

    -- negative/packaging_delivery: 리뷰이벤트 누락
    ('negative','리뷰이벤트 누락','리뷰이벤트 미이행'),
    ('negative','리뷰이벤트 누락','리뷰 서비스 누락'),
    ('negative','리뷰이벤트 누락','이벤트 누락'),

    -- negative/taste: 매워요
    ('negative','매워요','너무 매움'),
    ('negative','매워요','생각보다 매움'),
    ('negative','매워요','매운맛 강함'),
    ('negative','매워요','맵기 강함'),
    ('negative','매워요','과하게 매움'),
    ('negative','매워요','1단계도 매움'),
    ('negative','매워요','정말 매움'),

    -- negative/taste: 간이 안 맞아요
    ('negative','간이 안 맞아요','간이 안 맞음'),
    ('negative','간이 안 맞아요','간이 너무 강함'),
    ('negative','간이 안 맞아요','강한 간'),
    ('negative','간이 안 맞아요','간이 셈'),
    ('negative','간이 안 맞아요','싱거운 맛')
) AS x(sentiment, canonical_keyword, alias)
JOIN review_keyword_dictionary d
  ON d.sentiment = x.sentiment
 AND d.canonical_keyword = x.canonical_keyword
ON CONFLICT DO NOTHING;

