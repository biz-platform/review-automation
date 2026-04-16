import {
  addCalendarDaysKst,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import type { DashboardReviewAnalysisRow } from "@/lib/dashboard/fetch-dashboard-reviews-in-scope";

/** YYYY-MM-DD 달력 순서 비교 */
function ymdCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function inUtcWindow(
  writtenAt: string | null,
  startMs: number,
  endMs: number,
): boolean {
  if (!writtenAt) return false;
  const t = new Date(writtenAt).getTime();
  return t >= startMs && t <= endMs;
}

/** 한눈 요약과 동일: 땡겨요는 별점 체계가 아니어서 평균 별점에서 제외 */
export function avgRatingStarPlatforms(
  rows: DashboardReviewAnalysisRow[],
): number | null {
  const nums = rows
    .filter((r) => r.platform !== "ddangyo")
    .map((r) => r.rating)
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/**
 * 별점 분포: 땡겨요 맛있어요 지수(rating 5)는 5점 행에서 제외.
 * 퍼센트 분모: 조회 기간 내 전체 리뷰 수(A-2와 동일).
 */
export function buildStarDistribution(
  rowsInPeriod: DashboardReviewAnalysisRow[],
): { star: 1 | 2 | 3 | 4 | 5; count: number; percent: number }[] {
  const total = rowsInPeriod.length;
  const counts: Record<1 | 2 | 3 | 4 | 5, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  for (const r of rowsInPeriod) {
    const rating = r.rating;
    if (rating == null || !Number.isFinite(rating)) continue;
    const rv = Math.round(Number(rating));
    if (rv < 1 || rv > 5) continue;
    if (r.platform === "ddangyo" && rv === 5) continue;
    counts[rv as 1 | 2 | 3 | 4 | 5] += 1;
  }

  const order: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1];
  return order.map((star) => ({
    star,
    count: counts[star],
    percent:
      total > 0 ? Math.round((counts[star] / total) * 100) : 0,
  }));
}

export type ReviewTrendBucket = {
  label: string;
  reviewCount: number;
  avgRating: number | null;
};

/** 30일·7일 모드 X축: 월/일만 */
function formatMonthDayLabel(ymd: string): string {
  const [, mo, da] = ymd.split("-");
  return `${mo}월 ${da}일`;
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 7일: `04월 01일 (화)` — KST 달력 기준 */
function formatDayLabelWithWeekday(ymd: string): string {
  const dt = new Date(`${ymd}T12:00:00+09:00`);
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  const w = WEEKDAY_KO[dt.getDay()];
  return `${m}월 ${d}일 (${w})`;
}

function bucketAvgRatingStarPlatforms(
  rows: DashboardReviewAnalysisRow[],
): number | null {
  return avgRatingStarPlatforms(rows);
}

function bucketReviewCount(rows: DashboardReviewAnalysisRow[]): number {
  return rows.length;
}

/**
 * 리뷰 추이: 7d는 일 7개, 30d는 glance와 동일하게 주 단위 버킷(첫 구간 잔여일 가능).
 */
export function buildReviewTrendBuckets(
  rowsInPeriod: DashboardReviewAnalysisRow[],
  range: "7d" | "30d",
  currentStartYmd: string,
  currentEndYmd: string,
): ReviewTrendBucket[] {
  if (range === "7d") {
    const out: ReviewTrendBucket[] = [];
    for (let i = 0; i < 7; i++) {
      const ymd = addCalendarDaysKst(currentStartYmd, i);
      const start = kstYmdBoundsUtc(ymd, false).getTime();
      const end = kstYmdBoundsUtc(ymd, true).getTime();
      const inB = rowsInPeriod.filter((r) =>
        inUtcWindow(r.written_at, start, end),
      );
      out.push({
        label: formatDayLabelWithWeekday(ymd),
        reviewCount: bucketReviewCount(inB),
        avgRating: bucketAvgRatingStarPlatforms(inB),
      });
    }
    return out;
  }

  const out: ReviewTrendBucket[] = [];
  let weekStart = currentStartYmd;
  while (ymdCompare(weekStart, currentEndYmd) <= 0) {
    const weekEndBy7 = addCalendarDaysKst(weekStart, 6);
    const endYmd =
      ymdCompare(weekEndBy7, currentEndYmd) <= 0 ? weekEndBy7 : currentEndYmd;
    const start = kstYmdBoundsUtc(weekStart, false).getTime();
    const end = kstYmdBoundsUtc(endYmd, true).getTime();
    const inB = rowsInPeriod.filter((r) =>
      inUtcWindow(r.written_at, start, end),
    );
    out.push({
      label: formatMonthDayLabel(weekStart),
      reviewCount: bucketReviewCount(inB),
      avgRating: bucketAvgRatingStarPlatforms(inB),
    });
    if (ymdCompare(endYmd, currentEndYmd) >= 0) break;
    weekStart = addCalendarDaysKst(endYmd, 1);
  }
  return out;
}
