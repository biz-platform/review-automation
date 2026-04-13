/** 주문 동기화(baemin/yogiyo/ddangyo/coupang_eats orders_sync) 중간 진행 로그. */
export function isWorkerOrdersSyncVerbose(): boolean {
  const v = (s: string | undefined) =>
    s === "1" || s?.toLowerCase() === "true";
  return (
    v(process.env.WORKER_VERBOSE) ||
    v(process.env.ORDERS_SYNC_VERBOSE)
  );
}
