/** 리뷰 관리 매장 필터 세그먼트 파싱 — `app` 레이어에 의존하지 않음 */

export type ParsedStoreFilterTarget = {
  storeId: string;
  platform: string;
  platformShopExternalId?: string;
};

/** "uuid:baemin:10652466" 또는 "uuid:coupang_eats:480399" 등 세그먼트 하나 파싱 */
export function parseStoreFilterSegment(
  segment: string,
): ParsedStoreFilterTarget | null {
  const p = segment.trim();
  if (!p) return null;
  const parts = p.split(":");
  if (parts.length >= 3 && parts[1]) {
    const platform = parts[1].trim();
    if (!platform) return null;
    return {
      storeId: parts[0] ?? "",
      platform,
      platformShopExternalId: parts.slice(2).join(":").trim() || undefined,
    };
  }
  const i = p.indexOf(":");
  if (i <= 0) return null;
  return {
    storeId: p.slice(0, i),
    platform: p.slice(i + 1),
  };
}
