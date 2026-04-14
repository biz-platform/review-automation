-- 대시보드 한눈 요약 인사이트(규칙 기반 / 추후 Gemini) 캐시
-- 주문 원장(store_platform_orders) 갱신 시각(watermark) + 지표 지문(fingerprint)으로 무효화

CREATE TABLE public.dashboard_glance_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  store_scope_key text NOT NULL,
  range text NOT NULL CHECK (range IN ('7d', '30d')),
  platform_filter text NOT NULL DEFAULT '',
  metrics_fingerprint text NOT NULL,
  orders_watermark_at timestamptz NULL,
  insight_text text NOT NULL,
  insight_source text NOT NULL DEFAULT 'rules' CHECK (insight_source IN ('rules', 'gemini')),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_dashboard_glance_ai_insights_scope
  ON public.dashboard_glance_ai_insights (subject_user_id, store_scope_key, range, platform_filter);

CREATE INDEX idx_dashboard_glance_ai_insights_subject_updated
  ON public.dashboard_glance_ai_insights (subject_user_id, updated_at DESC);

COMMENT ON TABLE public.dashboard_glance_ai_insights IS '대시보드 한눈 요약 인사이트 캐시. 지표 fingerprint·주문 watermark가 일치할 때만 재사용.';
COMMENT ON COLUMN public.dashboard_glance_ai_insights.subject_user_id IS '집계 대상 매장 소유자(auth.users). 어드민 조회 시에도 고객 user id.';
COMMENT ON COLUMN public.dashboard_glance_ai_insights.store_scope_key IS 'API storeId 쿼리 원문(all, uuid, uuid:platform 등)';
COMMENT ON COLUMN public.dashboard_glance_ai_insights.metrics_fingerprint IS 'current/previous/deltas/platformBreakdown 기반 SHA-256 hex';
COMMENT ON COLUMN public.dashboard_glance_ai_insights.orders_watermark_at IS '해당 스코프 매장들 store_platform_orders.updated_at 최댓값';

ALTER TABLE public.dashboard_glance_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY dashboard_glance_ai_insights_select_own
  ON public.dashboard_glance_ai_insights FOR SELECT
  USING (subject_user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_glance_ai_insights_insert_own
  ON public.dashboard_glance_ai_insights FOR INSERT
  WITH CHECK (subject_user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_glance_ai_insights_update_own
  ON public.dashboard_glance_ai_insights FOR UPDATE
  USING (subject_user_id = (SELECT auth.uid()))
  WITH CHECK (subject_user_id = (SELECT auth.uid()));

CREATE POLICY dashboard_glance_ai_insights_delete_own
  ON public.dashboard_glance_ai_insights FOR DELETE
  USING (subject_user_id = (SELECT auth.uid()));
