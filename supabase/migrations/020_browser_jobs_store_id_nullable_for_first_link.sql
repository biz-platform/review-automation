-- 첫 연동 시 매장 없이 job 생성 후, 연동 성공 시에만 매장 생성하기 위해 store_id nullable 허용
ALTER TABLE browser_jobs
  ALTER COLUMN store_id DROP NOT NULL;

-- 기존 정책 제거 후, store_id NULL(본인 user_id) 또는 기존 store 소유 조건으로 재정의
DROP POLICY IF EXISTS "Users can read own store jobs" ON browser_jobs;
CREATE POLICY "Users can read own store jobs"
  ON browser_jobs FOR SELECT
  USING (
    (store_id IS NULL AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM stores s WHERE s.id = browser_jobs.store_id AND s.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own store jobs" ON browser_jobs;
CREATE POLICY "Users can insert own store jobs"
  ON browser_jobs FOR INSERT
  WITH CHECK (
    (store_id IS NULL AND user_id = auth.uid() AND type IN ('baemin_link', 'yogiyo_link', 'ddangyo_link', 'coupang_eats_link'))
    OR EXISTS (SELECT 1 FROM stores s WHERE s.id = browser_jobs.store_id AND s.user_id = auth.uid())
  );
