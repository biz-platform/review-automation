-- 브라우저 작업 큐: 서버는 job만 생성, 로컬 워커가 처리
CREATE TYPE browser_job_type AS ENUM (
  'baemin_link',
  'baemin_sync',
  'coupang_eats_link',
  'coupang_eats_sync',
  'yogiyo_link',
  'yogiyo_sync',
  'ddangyo_link',
  'ddangyo_sync'
);

CREATE TYPE browser_job_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed'
);

CREATE TABLE browser_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type browser_job_type NOT NULL,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status browser_job_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}',
  result JSONB,
  error_message TEXT,
  worker_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_browser_jobs_status_created ON browser_jobs(status, created_at);
CREATE INDEX idx_browser_jobs_store_id ON browser_jobs(store_id);

ALTER TABLE browser_jobs ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 매장에 대한 job만 조회 가능 (상태 폴링용)
CREATE POLICY "Users can read own store jobs"
  ON browser_jobs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = browser_jobs.store_id AND s.user_id = auth.uid())
  );

-- 사용자는 자신의 매장에 대한 job만 생성 가능 (link/sync API 호출 시)
CREATE POLICY "Users can insert own store jobs"
  ON browser_jobs FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = browser_jobs.store_id AND s.user_id = auth.uid())
  );

-- UPDATE/DELETE는 서버(service role)에서만 워커 결과 제출 시 사용
-- RLS 정책 없음 → anon 키로는 수정 불가, service role로만 수정 가능

-- 워커가 pending 1건을 원자적으로 선점 (동시성 안전)
CREATE OR REPLACE FUNCTION claim_next_browser_job(p_worker_id TEXT)
RETURNS SETOF browser_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM browser_jobs
  WHERE status = 'pending'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE browser_jobs
  SET status = 'processing', worker_id = p_worker_id, updated_at = now()
  WHERE id = v_id;

  RETURN QUERY SELECT * FROM browser_jobs WHERE id = v_id;
END;
$$;
