-- Table Editor / 관계 필터: `store_platform_shops.id` 단일 FK가 복합 FK보다 UI와 잘 맞음.
-- 062 복합 FK 제거 → `store_platform_shop_id` 로만 참조 (무결성 동등: 점포 행 1건과 연결).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'store_platform_orders'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'store_platform_orders'
      AND column_name = 'store_platform_shop_id'
  ) THEN
    ALTER TABLE store_platform_orders
      ADD COLUMN store_platform_shop_id uuid;
  END IF;

  UPDATE store_platform_orders o
  SET store_platform_shop_id = s.id
  FROM store_platform_shops s
  WHERE o.store_platform_shop_id IS NULL
    AND s.store_id = o.store_id
    AND s.platform = o.platform
    AND trim(s.platform_shop_external_id) = trim(o.platform_shop_external_id);

  IF EXISTS (
    SELECT 1
    FROM store_platform_orders
    WHERE store_platform_shop_id IS NULL
  ) THEN
    RAISE EXCEPTION '063: store_platform_shop_id 백필 실패 (shops와 매칭 안 되는 행 있음)';
  END IF;

  ALTER TABLE store_platform_orders
    ALTER COLUMN store_platform_shop_id SET NOT NULL;

  ALTER TABLE store_platform_orders
    DROP CONSTRAINT IF EXISTS store_platform_orders_store_platform_shop_fk;

  ALTER TABLE store_platform_orders
    DROP CONSTRAINT IF EXISTS store_platform_orders_store_platform_shop_id_fkey;

  ALTER TABLE store_platform_orders
    ADD CONSTRAINT store_platform_orders_store_platform_shop_id_fkey
    FOREIGN KEY (store_platform_shop_id) REFERENCES store_platform_shops(id) ON DELETE RESTRICT;

  CREATE INDEX IF NOT EXISTS idx_store_platform_orders_store_platform_shop_id
    ON store_platform_orders(store_platform_shop_id);
END $$;
