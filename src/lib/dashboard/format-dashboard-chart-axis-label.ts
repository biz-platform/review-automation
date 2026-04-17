/**
 * glance / 매출 API `series[].label` 형식:
 * - 일별: `YY.MM.DD` (예: 26.04.10)
 * - 주간: `YY.MM.DD–YY.MM.DD`
 */
const GLANCE_OR_SALES_DAY_LABEL = /^\d{2}\.\d{2}\.\d{2}$/;
const GLANCE_OR_SALES_WEEK_LABEL =
  /^\d{2}\.\d{2}\.\d{2}–\d{2}\.\d{2}\.\d{2}$/;

/**
 * 모바일 등 좁은 뷰에서 축 라벨의 **연도(앞 2자리 + 점)** 를 생략하고 월·일만 남김.
 * 리뷰 분석(`M월 D일 (요일)` 등)은 패턴이 달라 그대로 둠.
 */
export function formatDashboardChartAxisLabel(
  label: string,
  omitYear: boolean,
): string {
  if (!omitYear || !label.trim()) return label;

  if (GLANCE_OR_SALES_WEEK_LABEL.test(label)) {
    return label
      .split("–")
      .map((part) => part.replace(/^\d{2}\./, ""))
      .join("–");
  }
  if (GLANCE_OR_SALES_DAY_LABEL.test(label)) {
    return label.replace(/^\d{2}\./, "");
  }
  return label;
}
