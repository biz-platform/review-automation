-- work_log_entries: anon 직접 조회 차단. 본인 user_id 행만 SELECT (INSERT 는 service_role 등 RLS 우회 역할 사용).

ALTER TABLE public.work_log_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own work_log_entries" ON public.work_log_entries;

CREATE POLICY "Users can read own work_log_entries"
  ON public.work_log_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.work_log_entries IS
  '작업 로그. browser_jobs 완료/실패 시 적재. RLS: 본인 SELECT만. service_role 은 RLS 우회.';
