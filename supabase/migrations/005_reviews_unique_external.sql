-- 배민 등 플랫폼 리뷰 동기화 시 upsert용 (store_id, platform, external_id) 유일
-- external_id가 NULL인 기존 mock 데이터는 영향 없음 (NULL은 unique에서 서로 다른 값으로 취급)
ALTER TABLE reviews
  ADD CONSTRAINT reviews_store_platform_external_key UNIQUE (store_id, platform, external_id);