-- sync 등 완료 시 result JSON이 커져 Supabase/제한(예: 10,240자)에 걸리는 문제 방지.
-- 경량 요약은 result_summary, 대량 데이터는 reviews 테이블 등에만 둠.

ALTER TABLE public.browser_jobs
  ADD COLUMN IF NOT EXISTS result_summary JSONB;

COMMENT ON COLUMN public.browser_jobs.result_summary IS '완료 시 경량 요약(건수·메타·reviewSnapshot 등). sync 리뷰 배열은 미포함.';
