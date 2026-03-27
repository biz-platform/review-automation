/** 리뷰 수집/보관 기본 기간(일). 첫 연동·초기 풀 동기화에 사용. 모든 플랫폼 공통. */
export const REVIEW_RETENTION_DAYS = 180;

/**
 * 이미 DB에 해당 플랫폼 리뷰가 있을 때 이후 sync(수동·크론)에서만 쓰는 짧은 구간.
 * 첫 수집(테이블에 행 없음)은 {@link REVIEW_RETENTION_DAYS}와 동일한 풀 범위.
 */
export const REVIEW_SYNC_INCREMENTAL_DAYS = 30;

/**
 * 오늘 기준 과거 REVIEW_RETENTION_DAYS일 구간의 시작·종료 Date.
 * 각 플랫폼은 이 값을 포맷 헬퍼로 문자열 변환해 사용.
 */
export function getDefaultReviewDateRange(): { since: Date; to: Date } {
  const to = new Date();
  const since = new Date(to);
  since.setDate(since.getDate() - REVIEW_RETENTION_DAYS);
  return { since, to };
}

/** 최근 N일만 (종료일은 오늘). */
export function getReviewDateRangeForPastDays(days: number): { since: Date; to: Date } {
  const to = new Date();
  const since = new Date(to);
  since.setDate(since.getDate() - days);
  return { since, to };
}

export function getIncrementalSyncReviewDateRange(): { since: Date; to: Date } {
  return getReviewDateRangeForPastDays(REVIEW_SYNC_INCREMENTAL_DAYS);
}

/**
 * @param hasExistingReviews 해당 store+platform으로 `reviews`에 1건이라도 있으면 true (이미 동기화된 매장)
 */
export function getSyncReviewDateRange(hasExistingReviews: boolean): { since: Date; to: Date } {
  return hasExistingReviews ? getIncrementalSyncReviewDateRange() : getDefaultReviewDateRange();
}

export function getSyncReviewDateRangeFormatted(hasExistingReviews: boolean): {
  from: string;
  to: string;
} {
  const { since, to } = getSyncReviewDateRange(hasExistingReviews);
  return { from: toYYYYMMDD(since), to: toYYYYMMDD(to) };
}

/** YYYY-MM-DD (배민, 요기요 등) */
export function toYYYYMMDD(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** YYYYMMDD (땡겨요 API) */
export function toYYYYMMDDCompact(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

/** 배민/요기요용: { from, to } YYYY-MM-DD */
export function getDefaultReviewDateRangeFormatted(): { from: string; to: string } {
  const { since, to } = getDefaultReviewDateRange();
  return { from: toYYYYMMDD(since), to: toYYYYMMDD(to) };
}
