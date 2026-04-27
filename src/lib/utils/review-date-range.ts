/** 리뷰 수집/보관 기본 기간(일). 첫 연동·초기 풀 동기화에 사용. 모든 플랫폼 공통. */
export const REVIEW_RETENTION_DAYS = 180;

/**
 * - `initial`: 연동 직후 첫 백필 — {@link REVIEW_RETENTION_DAYS}일(약 6개월).
 * - `ongoing`: 수동·크론·실시간 동기화 — {@link REVIEW_SYNC_INCREMENTAL_DAYS}일(약 1개월)만.
 */
export type ReviewSyncWindow = "initial" | "ongoing";

/** 주기적/수동 동기화 창(약 1개월). */
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
export function getReviewDateRangeForPastDays(days: number): {
  since: Date;
  to: Date;
} {
  const to = new Date();
  const since = new Date(to);
  since.setDate(since.getDate() - days);
  return { since, to };
}

export function getIncrementalSyncReviewDateRange(): { since: Date; to: Date } {
  return getReviewDateRangeForPastDays(REVIEW_SYNC_INCREMENTAL_DAYS);
}

export function getReviewSyncWindowDateRange(window: ReviewSyncWindow): {
  since: Date;
  to: Date;
} {
  return window === "initial"
    ? getDefaultReviewDateRange()
    : getIncrementalSyncReviewDateRange();
}

export function getReviewSyncWindowDateRangeFormatted(
  window: ReviewSyncWindow,
): { from: string; to: string } {
  const { since, to } = getReviewSyncWindowDateRange(window);
  return { from: toYYYYMMDD(since), to: toYYYYMMDD(to) };
}

/**
 * @deprecated DB에 리뷰 유무 대신 {@link getReviewSyncWindowDateRange}(`initial` | `ongoing`) 사용.
 * @param hasExistingReviews 해당 store+platform으로 `reviews`에 1건이라도 있으면 true
 */
export function getSyncReviewDateRange(hasExistingReviews: boolean): {
  since: Date;
  to: Date;
} {
  return getReviewSyncWindowDateRange(
    hasExistingReviews ? "ongoing" : "initial",
  );
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
export function getDefaultReviewDateRangeFormatted(): {
  from: string;
  to: string;
} {
  const { since, to } = getDefaultReviewDateRange();
  return { from: toYYYYMMDD(since), to: toYYYYMMDD(to) };
}
