/**
 * 한눈 요약 KPI: 직전 동일 기간 대비 증감률(%), 소수 첫째 자리 반올림.
 * 이전 기간 건수가 0일 때는 `safePercentDelta`와 동일하게
 * 현재>0 → 100, 그 외 → 0.
 */
export function glanceCountDeltaPercent(curr: number, prev: number): number {
  if (!Number.isFinite(curr) || !Number.isFinite(prev)) return 0;
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}
