-- 주문 원장 장기 보관으로 테이블·인덱스 팽창 방지. 아카이브 테이블 없이 order_at 기준 초과분만 삭제.
-- glance·주문 동기화는 최대 ~60일 구간을 쓰므로 기본 보관 90일(여유) 후 퍼지.

CREATE INDEX IF NOT EXISTS idx_store_platform_orders_order_at
  ON public.store_platform_orders (order_at);

COMMENT ON INDEX public.idx_store_platform_orders_order_at IS
  'purge_old_store_platform_orders: WHERE order_at < cutoff 배치 삭제용';

CREATE OR REPLACE FUNCTION public.purge_old_store_platform_orders(
  p_retention_days integer DEFAULT 90,
  p_batch_size integer DEFAULT 5000,
  p_max_batches integer DEFAULT 100
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n_total bigint := 0;
  n_batch bigint;
  i int := 0;
  cutoff timestamptz;
BEGIN
  IF p_retention_days < 30 OR p_retention_days > 366 THEN
    RAISE EXCEPTION 'purge_old_store_platform_orders: p_retention_days must be between 30 and 366';
  END IF;
  IF p_batch_size < 100 OR p_batch_size > 20000 THEN
    RAISE EXCEPTION 'purge_old_store_platform_orders: p_batch_size must be between 100 and 20000';
  END IF;
  IF p_max_batches < 1 OR p_max_batches > 500 THEN
    RAISE EXCEPTION 'purge_old_store_platform_orders: p_max_batches must be between 1 and 500';
  END IF;

  cutoff := now() - (interval '1 day' * p_retention_days);

  LOOP
    DELETE FROM public.store_platform_orders
    WHERE id IN (
      SELECT o.id
      FROM public.store_platform_orders AS o
      WHERE o.order_at < cutoff
      LIMIT p_batch_size
    );
    GET DIAGNOSTICS n_batch = ROW_COUNT;
    n_total := n_total + n_batch;
    i := i + 1;
    EXIT WHEN n_batch = 0;
    EXIT WHEN i >= p_max_batches;
  END LOOP;

  RETURN n_total;
END;
$$;

COMMENT ON FUNCTION public.purge_old_store_platform_orders(integer, integer, integer) IS
  'order_at 기준 보관 일수 초과 행 배치 삭제. 기본 90일. service_role·크론.';

REVOKE ALL ON FUNCTION public.purge_old_store_platform_orders(integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_old_store_platform_orders(integer, integer, integer) TO service_role;
