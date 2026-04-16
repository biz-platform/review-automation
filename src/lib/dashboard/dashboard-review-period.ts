import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";

export type DashboardReviewPeriodBounds = {
  currentStartYmd: string;
  currentEndYmd: string;
  fetchStartIso: string;
  fetchEndIso: string;
  /** 예: 2026.02.27 - 2026.03.27 */
  periodLabel: string;
};

/** 대시보드 glance / 리뷰 분석과 동일한 KST 기간(어제까지 7일 또는 30일). */
export function getDashboardReviewPeriodBounds(
  range: "7d" | "30d",
): DashboardReviewPeriodBounds {
  const todayKst = formatKstYmd(new Date());
  const currentEndYmd = addCalendarDaysKst(todayKst, -1);
  const currentStartYmd =
    range === "7d"
      ? addCalendarDaysKst(currentEndYmd, -6)
      : addCalendarDaysKst(currentEndYmd, -29);

  const fetchStart = kstYmdBoundsUtc(currentStartYmd, false);
  const fetchEnd = kstYmdBoundsUtc(currentEndYmd, true);

  const periodLabel = `${currentStartYmd.replace(/-/g, ".")} - ${currentEndYmd.replace(/-/g, ".")}`;

  return {
    currentStartYmd,
    currentEndYmd,
    fetchStartIso: fetchStart.toISOString(),
    fetchEndIso: fetchEnd.toISOString(),
    periodLabel,
  };
}
