/** 매장 작업 상태 `hasError` 판정: `browser_jobs.status = failed` 조회 시작 시각 (UTC, rolling 24h) */
export function getAdminWorkStatusErrorWindowStartIso(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}
