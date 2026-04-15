-- 매출/메뉴 분석 AI 인사이트를 glance와 동일 테이블에 탭으로 분리 저장

ALTER TABLE public.dashboard_glance_ai_insights
  ADD COLUMN insight_tab text NOT NULL DEFAULT 'glance';

ALTER TABLE public.dashboard_glance_ai_insights
  ADD CONSTRAINT dashboard_glance_ai_insights_insight_tab_check
  CHECK (insight_tab IN ('glance', 'sales', 'menu'));

DROP INDEX IF EXISTS uq_dashboard_glance_ai_insights_scope;

CREATE UNIQUE INDEX uq_dashboard_glance_ai_insights_scope
  ON public.dashboard_glance_ai_insights (
    subject_user_id,
    store_scope_key,
    range,
    platform_filter,
    insight_tab
  );

COMMENT ON TABLE public.dashboard_glance_ai_insights IS '대시보드 탭별 AI 인사이트 캐시(glance/sales/menu). 지표 fingerprint·주문 watermark가 일치할 때만 재사용.';
COMMENT ON COLUMN public.dashboard_glance_ai_insights.insight_tab IS 'glance=한눈 요약, sales=매출 분석, menu=메뉴 분석';
