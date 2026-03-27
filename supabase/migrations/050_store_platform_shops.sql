-- 플랫폼 내부 다매장 식별 테이블 (세션 1행과 분리)
CREATE TABLE IF NOT EXISTS store_platform_shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  platform_shop_external_id text NOT NULL,
  shop_name text,
  shop_category text,
  is_primary boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, platform, platform_shop_external_id)
);

CREATE INDEX IF NOT EXISTS idx_store_platform_shops_store_platform
  ON store_platform_shops(store_id, platform);

ALTER TABLE store_platform_shops ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_platform_shops'
      AND policyname = 'Users can read store_platform_shops of own stores'
  ) THEN
    CREATE POLICY "Users can read store_platform_shops of own stores"
      ON store_platform_shops FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM stores s
          WHERE s.id = store_platform_shops.store_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM stores s
          WHERE s.id = store_platform_shops.store_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 기존 리뷰에 기록된 배민 shopNo 기반 백필
INSERT INTO store_platform_shops (
  store_id,
  platform,
  platform_shop_external_id,
  shop_name,
  shop_category,
  is_primary,
  first_seen_at,
  last_seen_at,
  created_at,
  updated_at
)
SELECT
  r.store_id,
  r.platform,
  trim(r.platform_shop_external_id) AS platform_shop_external_id,
  NULL::text AS shop_name,
  NULL::text AS shop_category,
  false AS is_primary,
  min(COALESCE(r.written_at, r.created_at, now())),
  max(COALESCE(r.written_at, r.created_at, now())),
  now(),
  now()
FROM reviews r
WHERE r.platform = 'baemin'::platform_enum
  AND r.platform_shop_external_id IS NOT NULL
  AND trim(r.platform_shop_external_id) <> ''
GROUP BY r.store_id, r.platform, trim(r.platform_shop_external_id)
ON CONFLICT (store_id, platform, platform_shop_external_id) DO UPDATE
SET
  first_seen_at = LEAST(store_platform_shops.first_seen_at, EXCLUDED.first_seen_at),
  last_seen_at = GREATEST(store_platform_shops.last_seen_at, EXCLUDED.last_seen_at),
  updated_at = now();

-- 대표 세션의 매장명/업종은 대표 점포에 우선 주입
UPDATE store_platform_shops sps
SET
  shop_name = COALESCE(NULLIF(trim(s.store_name), ''), sps.shop_name),
  shop_category = COALESCE(NULLIF(trim(s.shop_category), ''), sps.shop_category),
  is_primary = true,
  updated_at = now()
FROM store_platform_sessions s
WHERE sps.store_id = s.store_id
  AND sps.platform = s.platform::platform_enum
  AND s.platform = 'baemin'
  AND s.external_shop_id IS NOT NULL
  AND trim(s.external_shop_id) <> ''
  AND sps.platform_shop_external_id = trim(s.external_shop_id);
