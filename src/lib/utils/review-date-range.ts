/** 리뷰 수집/보관 기본 기간(일). 모든 플랫폼 공통. */
export const REVIEW_RETENTION_DAYS = 180;

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
