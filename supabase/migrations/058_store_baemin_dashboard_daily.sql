-- 배민 대시보드: 매장 × 플랫폼 점포 × KST 일 단위 집계 + 메뉴별 일별 판매 (주문 수집은 별도 워커 가정)
CREATE TABLE IF NOT EXISTS store_baemin_dashboard_daily (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
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
  PRIMARY KEY (store_id, platform_shop_external_id, kst_date)
);

CREATE INDEX IF NOT EXISTS idx_store_baemin_dashboard_daily_store_date
  ON store_baemin_dashboard_daily (store_id, kst_date DESC);

COMMENT ON TABLE store_baemin_dashboard_daily IS
  '배민 주문(v4) 집계. 총매출=일별 sum(payAmount), 정산=settle.total→depositDueAmount. CLOSED만 포함.';

COMMENT ON COLUMN store_baemin_dashboard_daily.total_pay_amount IS 'KST 해당 일 CLOSED 주문 order.payAmount 합(원).';
COMMENT ON COLUMN store_baemin_dashboard_daily.settlement_amount IS 'settle.total 합, 없으면 depositDueAmount 합(원).';
COMMENT ON COLUMN store_baemin_dashboard_daily.review_conversion_ratio IS 'review_count / order_count, order_count=0 이면 null.';

CREATE TABLE IF NOT EXISTS store_baemin_dashboard_menu_daily (
  store_id uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform_shop_external_id text NOT NULL,
  kst_date date NOT NULL,
  menu_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  line_total bigint NOT NULL DEFAULT 0,
  share_of_day_revenue numeric(10, 8),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, platform_shop_external_id, kst_date, menu_name)
);

CREATE INDEX IF NOT EXISTS idx_store_baemin_dashboard_menu_daily_store_date
  ON store_baemin_dashboard_menu_daily (store_id, kst_date DESC);

COMMENT ON TABLE store_baemin_dashboard_menu_daily IS
  '메뉴는 items[].name만(옵션 제외). line_total=행별 totalPrice 합, share=일 매출 대비 비율.';

ALTER TABLE store_baemin_dashboard_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_baemin_dashboard_menu_daily ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'store_baemin_dashboard_daily'
      AND policyname = 'Users can manage store_baemin_dashboard_daily of own stores'
  ) THEN
    CREATE POLICY "Users can manage store_baemin_dashboard_daily of own stores"
      ON store_baemin_dashboard_daily FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_baemin_dashboard_daily.store_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_baemin_dashboard_daily.store_id
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
      AND tablename = 'store_baemin_dashboard_menu_daily'
      AND policyname = 'Users can manage store_baemin_dashboard_menu_daily of own stores'
  ) THEN
    CREATE POLICY "Users can manage store_baemin_dashboard_menu_daily of own stores"
      ON store_baemin_dashboard_menu_daily FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_baemin_dashboard_menu_daily.store_id
            AND s.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM stores s
          WHERE s.id = store_baemin_dashboard_menu_daily.store_id
            AND s.user_id = auth.uid()
        )
      );
  END IF;
END $$;
