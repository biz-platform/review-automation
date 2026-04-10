/**
 * 땡겨요 리뷰는 별점이 아니라 `good_eval_cd === "1"` → DB `rating` 5(맛있어요)로만 저장됨.
 * 대시보드에서는 기간 내 리뷰 중 맛있어요 비율(%)을 쓴다.
 */
export function ddangyoTastyRatioPercent(
  rows: { rating: number | null }[],
): number | null {
  if (rows.length === 0) return null;
  const tasty = rows.filter((r) => r.rating === 5).length;
  return Math.round((tasty / rows.length) * 100);
}
