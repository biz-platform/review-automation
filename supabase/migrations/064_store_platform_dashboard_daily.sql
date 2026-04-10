-- 플랫폼 공통 대시보드 집계 (일별 KPI + 일×메뉴별 집계)
-- - 원장은 store_platform_orders. 본 테이블들은 조회·차트용 집계 캐시(정규화 granularity 상이함).
-- - menu_daily는 주문 행과 동일 데이터가 아니라 일·메뉴명 단위 rollup이며, orders.items와 "중복"이 아님.

CREATE TABLE IF NOT EXISTS store_platform_dashboard_daily (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  platform_shop_external_id text NOT NULL,
  kst_date date NOT NULL,
  order_count integer NOT NULL DEFAULT 0,
  total_pay_amount bigint NOT NULL DEFAULT 0,
  settlement_amount bigint NOT NULL DEFAULT 0,
  avg_order_amount integer,
  total_menu_quantity integer NOT NULL DEFAULT 0,
  distinct_menu_count integer NOT NULL DEFAULT 0,
  review_count integer,
  review_conversion_ratio numeric(8, 6),
  sync_status text NOT NULL DEFAULT 'complete'
    CHECK (sync_status IN ('complete', 'partial')),
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, platform, platform_shop_external_id, kst_date)
);

CREATE INDEX IF NOT EXISTS idx_store_platform_dashboard_daily_store_date
  ON store_platform_dashboard_daily (store_id, kst_date DESC);

CREATE INDEX IF NOT EXISTS idx_store_platform_dashboard_daily_platform
  ON store_platform_dashboard_daily (store_id, platform, kst_date DESC);

COMMENT ON TABLE store_platform_dashboard_daily IS
  '플랫폼 공통 일별 KPI 집계. 원장(store_platform_orders)과 중복 아님 — 기간 합산·리뷰전환 등 빠른 조회용.';

CREATE TABLE IF NOT EXISTS store_platform_dashboard_menu_daily (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  platform_shop_external_id text NOT NULL,
  kst_date date NOT NULL,
  menu_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  line_total bigint NOT NULL DEFAULT 0,
  share_of_day_revenue numeric(10, 8),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, platform, platform_shop_external_id, kst_date, menu_name)
);

CREATE INDEX IF NOT EXISTS idx_store_platform_dashboard_menu_daily_store_date
  ON store_platform_dashboard_menu_daily (store_id, kst_date DESC);

CREATE INDEX IF NOT EXISTS idx_store_platform_dashboard_menu_daily_platform
  ON store_platform_dashboard_menu_daily (store_id, platform, kst_date DESC);

COMMENT ON TABLE store_platform_dashboard_menu_daily IS
  '플랫폼 공통 일×메뉴별 판매 집계. 주문 원장과 다른 granularity(메뉴명 기준 rollup).';

-- 기존 배민 전용 테이블 → 통합 테이블 이관 후 삭제
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'store_baemin_dashboard_daily'
  ) THEN
    INSERT INTO store_platform_dashboard_daily (
      store_id, platform, platform_shop_external_id, kst_date,
      order_count, total_pay_amount, settlement_amount, avg_order_amount,
      total_menu_quantity, distinct_menu_count, review_count, review_conversion_ratio,
      sync_status, last_error, updated_at, created_at
    )
    SELECT
      store_id,
      'baemin'::platform_enum,
      platform_shop_external_id,
      kst_date,
      order_count, total_pay_amount, settlement_amount, avg_order_amount,
      total_menu_quantity, distinct_menu_count, review_count, review_conversion_ratio,
      sync_status, last_error, updated_at, created_at
    FROM store_baemin_dashboard_daily
    ON CONFLICT (store_id, platform, platform_shop_external_id, kst_date) DO NOTHING;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'store_baemin_dashboard_menu_daily'
  ) THEN
    INSERT INTO store_platform_dashboard_menu_daily (
      store_id, platform, platform_shop_external_id, kst_date, menu_name,
      quantity, line_total, share_of_day_revenue, updated_at, created_at
    )
    SELECT
      store_id,
      'baemin'::platform_enum,
      platform_shop_external_id,
      kst_date,
      menu_name,
      quantity, line_total, share_of_day_revenue, updated_at, created_at
    FROM store_baemin_dashboard_menu_daily
    ON CONFLICT (store_id, platform, platform_shop_external_id, kst_date, menu_name) DO NOTHING;
  END IF;
END $$;

DROP TABLE IF EXISTS store_baemin_dashboard_menu_daily;
DROP TABLE IF EXISTS store_baemin_dashboard_daily;

ALTER TABLE store_platform_dashboard_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_platform_dashboard_menu_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_platform_dashboard_daily'
      AND policyname = 'Users can manage store_platform_dashboard_daily of own stores'
  ) THEN
    CREATE POLICY "Users can manage store_platform_dashboard_daily of own stores"
      ON store_platform_dashboard_daily FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_platform_dashboard_daily.store_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_platform_dashboard_daily.store_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_platform_dashboard_menu_daily'
      AND policyname = 'Users can manage store_platform_dashboard_menu_daily of own stores'
  ) THEN
    CREATE POLICY "Users can manage store_platform_dashboard_menu_daily of own stores"
      ON store_platform_dashboard_menu_daily FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_platform_dashboard_menu_daily.store_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_platform_dashboard_menu_daily.store_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;
