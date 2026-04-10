-- reviews.external_id: NULL 은 UNIQUE 에서 서로 다른 행으로 취급되어 중복 방지가 약함.
-- 앱은 플랫폼 리뷰 식별자를 항상 채우는 전제(프로덕션 NULL 0건 확인 후 적용).

ALTER TABLE reviews
  ALTER COLUMN external_id SET NOT NULL;

COMMENT ON COLUMN reviews.external_id IS '플랫폼 리뷰 ID. NOT NULL (동일 매장·플랫폼 내 유니크 식별).';
