-- 설계서 canonical을 source of truth로 고정하기 위한 보강 마이그레이션.
-- - 누락된 canonical 추가
-- - 흔히 쓰이는 기존 표현(배달이 빨라요 등)을 alias로 흡수
-- NOTE: 이미 적용된 073이 있더라도 중복/충돌은 ON CONFLICT로 회피한다.

-- 1) canonical upsert (설계서)
INSERT INTO review_keyword_dictionary (sentiment, category, canonical_keyword) VALUES
  -- positive / packaging_delivery (설계서 canonical)
  ('positive', 'packaging_delivery', '빠른 배달'),
  ('positive', 'packaging_delivery', '정성'),
  ('positive', 'packaging_delivery', '서비스'),
  ('positive', 'packaging_delivery', '친절'),

  -- positive / revisit_recommend
  ('positive', 'revisit_recommend', '주변 추천'),

  -- positive / taste (설계서 키워드 중 073과 표현 차이 보정)
  ('positive', 'taste', '맛이 변함없어요'),

  -- negative / revisit_recommend
  ('negative', 'revisit_recommend', '주변에 비추해요')
ON CONFLICT DO NOTHING;

-- 2) alias 보강: 기존에 화면에 자주 뜨는 표현을 설계서 canonical로 매핑
INSERT INTO review_keyword_dictionary_aliases (dictionary_id, alias)
SELECT d.id, x.alias
FROM (
  VALUES
    -- positive / packaging_delivery: 빠른 배달
    ('positive','빠른 배달','배달이 빨라요'),
    ('positive','빠른 배달','배달 빠름'),

    -- positive / packaging_delivery: 서비스
    ('positive','서비스','요청사항 반영'),
    ('positive','서비스','서비스 만족'),

    -- positive / packaging_delivery: 친절
    ('positive','친절','친절한 서비스'),

    -- positive / revisit_recommend: 주변 추천
    ('positive','주변 추천','강력 추천'),
    ('positive','주변 추천','추천해요'),
    ('positive','주변 추천','맛집 추천'),

    -- positive / revisit_recommend: 단골
    ('positive','단골','단골 예약'),

    -- positive / revisit_recommend: 재주문 예정
    ('positive','재주문 예정','재주문 의사'),
    ('positive','재주문 예정','재주문'),
    ('positive','재주문 예정','재방문 의사'),

    -- positive / taste: 맛있어요
    ('positive','맛있어요','맛있음'),
    ('positive','맛있어요','맛있습니다'),
    ('positive','맛있어요','맛이 좋음'),
    ('positive','맛있어요','맛이 훌륭함'),
    ('positive','맛있어요','뛰어난 맛'),
    ('positive','맛있어요','훌륭한 맛'),
    ('positive','맛있어요','최고의 맛'),

    -- positive / quantity_price: 합리적이에요
    ('positive','합리적이에요','가성비 좋음'),

    -- negative / taste: 맛이 없어요
    ('negative','맛이 없어요','맛없음'),

    -- negative / taste: 싱거워요
    ('negative','싱거워요','싱거운 간'),
    ('negative','싱거워요','간이 싱거움'),

    -- negative / taste: 간이 안 맞아요
    ('negative','간이 안 맞아요','간이 강함'),
    ('negative','간이 안 맞아요','강한 간'),
    ('negative','간이 안 맞아요','간 조절 필요'),

    -- negative / packaging_delivery: 포장 불량
    ('negative','포장 불량','포장 상태 불량'),

    -- negative / packaging_delivery: 수저 누락
    ('negative','수저 누락','수저 미동봉'),

    -- negative / packaging_delivery: 요청사항 누락
    ('negative','요청사항 누락','요청사항 미이행'),

    -- negative / packaging_delivery: 메뉴 누락
    ('negative','메뉴 누락','구성품 누락'),
    ('negative','메뉴 누락','구성품 누락 확인'),

    -- negative / revisit_recommend: 주변에 비추해요
    ('negative','주변에 비추해요','비추해요'),
    ('negative','주변에 비추해요','맛집 비추')
) AS x(sentiment, canonical_keyword, alias)
JOIN review_keyword_dictionary d
  ON d.sentiment = x.sentiment
 AND d.canonical_keyword = x.canonical_keyword
ON CONFLICT DO NOTHING;

