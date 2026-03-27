/**
 * 배민 다매장: 리뷰 id가 점포 간 중복될 수 있음.
 * DB 유니크 (store_id, platform, external_id) 충돌 방지용.
 */
export function composeBaeminStoredExternalId(
  platformShopExternalId: string | null | undefined,
  rawReviewId: string,
): string {
  const raw = rawReviewId.trim();
  const shop = platformShopExternalId?.trim();
  if (shop && raw) return `${shop}:${raw}`;
  return raw;
}

/** 셀프서비스·리뷰번호 매칭용 — 화면에는 플랫폼 리뷰 id만 표시됨 */
export function baeminUiReviewNumberFromStoredExternalId(stored: string): string {
  const s = stored.trim();
  const i = s.indexOf(":");
  if (i === -1) return s;
  return s.slice(i + 1).trim();
}
