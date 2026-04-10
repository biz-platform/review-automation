-- 주문 동기화 워커 job 타입 (로컬 enum에 없을 수 있어 IF NOT EXISTS)
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'baemin_orders_sync';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'yogiyo_orders_sync';
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'ddangyo_orders_sync';
