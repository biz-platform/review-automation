-- 다매장 배민: 리뷰 id가 점포 간 중복될 수 있어 external_id를 shopNo:rawId 로 통일.
-- 기존 단일 매장 행은 platform_shop_external_id 기준으로 백필해 sync 시 불필요한 삭제·재삽입(uuid 변경) 방지.

UPDATE reviews
SET external_id = trim(platform_shop_external_id) || ':' || external_id
WHERE platform = 'baemin'::platform_enum
  AND platform_shop_external_id IS NOT NULL
  AND trim(platform_shop_external_id) <> ''
  AND external_id IS NOT NULL
  AND external_id NOT LIKE '%:%';

UPDATE reviews_archive
SET external_id = trim(platform_shop_external_id) || ':' || external_id
WHERE platform = 'baemin'::platform_enum
  AND platform_shop_external_id IS NOT NULL
  AND trim(platform_shop_external_id) <> ''
  AND external_id IS NOT NULL
  AND external_id NOT LIKE '%:%';
