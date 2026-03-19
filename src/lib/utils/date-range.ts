import { format, subDays } from "date-fns";

/** 최근 7일(오늘 포함) 기간. 매장 목록/상세 등 기간 필터 기본값 */
export function getDefaultDateRangeLast7Days() {
  const today = new Date();
  const from = subDays(today, 6);
  return {
    dateFrom: format(from, "yyyy-MM-dd"),
    dateTo: format(today, "yyyy-MM-dd"),
  };
}
