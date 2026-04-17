/**
 * `dashboard_glance_ai_insights.store_scope_key`는 요청의 `storeId` 문자열을 그대로 쓴다.
 * 단일 매장만 집계에 포함될 때는 `all`과 순수 매장 UUID가 동일 스코프이므로 캐시 키를 하나로 맞춘다.
 * (복합 `uuid:플랫폼`·콤마 다중 세그먼트는 집계 의미가 달라 그대로 둔다.)
 */

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainStoreUuidSegment(raw: string): boolean {
  const v = raw.trim();
  return (
    STORE_UUID_RE.test(v) && !v.includes(":") && !v.includes(",")
  );
}

export function canonicalDashboardAiStoreScopeKey(args: {
  storeIdRaw: string;
  storeIdsForQuery: string[];
}): string {
  const raw = args.storeIdRaw.trim();
  if (args.storeIdsForQuery.length !== 1) {
    return raw;
  }
  const only = args.storeIdsForQuery[0]!;
  if (raw === "all" || isPlainStoreUuidSegment(raw)) {
    return only;
  }
  return raw;
}
