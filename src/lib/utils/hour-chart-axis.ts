/**
 * 시간 막대 차트 X축 — 막대는 매 시, 숫자는 2시간 간격 위주(대시보드·주간 리포트 공통).
 */
export function shouldShowHourChartAxisLabel(
  hour: number,
  minHour: number,
  maxHour: number,
): boolean {
  if (minHour === maxHour) return true;
  if (hour % 2 === 0) return true;
  if (hour === minHour || hour === maxHour) return true;
  return false;
}
