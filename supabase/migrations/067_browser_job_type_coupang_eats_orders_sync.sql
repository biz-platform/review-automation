-- 워커: 쿠팡이츠 주문 동기화 (매장별 order/condition API)
ALTER TYPE browser_job_type ADD VALUE IF NOT EXISTS 'coupang_eats_orders_sync';
