-- 쿠팡이츠 실제 정산(순액) 저장용 컬럼 추가
-- - `store_platform_orders.pay_amount`: 주문 결제(총액)
-- - `store_platform_orders.actually_amount`: 플랫폼 실정산(순액). 현재는 coupang_eats만 채움

ALTER TABLE public.store_platform_orders
  ADD COLUMN IF NOT EXISTS actually_amount integer NULL;

