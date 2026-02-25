-- 사용자 취소 요청 시 워커가 중단할 수 있도록 상태 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'cancelled'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'browser_job_status')
  ) THEN
    ALTER TYPE browser_job_status ADD VALUE 'cancelled';
  END IF;
END
$$;
