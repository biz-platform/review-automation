-- store_platform_orders.platform_shop_external_id ↔ store_platform_shops (동일 복합 키) 참조 무결성

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'store_platform_orders'
  ) THEN
    RAISE NOTICE 'store_platform_orders 없음 — 스킵';
    RETURN;
  END IF;

  -- 기존 주문에만 있고 shops에 없는 점포 → 최소 행 백필 (FK 추가 전)
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
  SELECT DISTINCT
    o.store_id,
    o.platform,
    trim(o.platform_shop_external_id) AS platform_shop_external_id,
    NULL::text,
    NULL::text,
    false,
    now(),
    now(),
    now(),
    now()
  FROM store_platform_orders o
  WHERE trim(coalesce(o.platform_shop_external_id, '')) <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM store_platform_shops s
      WHERE s.store_id = o.store_id
        AND s.platform = o.platform
        AND s.platform_shop_external_id = trim(o.platform_shop_external_id)
    )
  ON CONFLICT (store_id, platform, platform_shop_external_id) DO NOTHING;

  ALTER TABLE store_platform_orders
    DROP CONSTRAINT IF EXISTS store_platform_orders_store_platform_shop_fk;

  ALTER TABLE store_platform_orders
    ADD CONSTRAINT store_platform_orders_store_platform_shop_fk
    FOREIGN KEY (store_id, platform, platform_shop_external_id)
    REFERENCES store_platform_shops (store_id, platform, platform_shop_external_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
END $$;
