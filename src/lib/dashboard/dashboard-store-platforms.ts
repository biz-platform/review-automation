import type { StoreWithSessionData } from "@/entities/store/types";

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DASHBOARD_CHIP_PLATFORMS = new Set([
  "baemin",
  "coupang_eats",
  "ddangyo",
  "yogiyo",
]);

function normalizeUuidCandidate(s: string): string | null {
  const t = s.normalize("NFKC").trim();
  if (STORE_UUID_RE.test(t)) return t.toLowerCase();
  const compact = t.replace(/-/g, "");
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    const h = compact.toLowerCase();
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  }
  return null;
}

/** `uuid:플랫폼` / `uuid:플랫폼:외부id` 에서 플랫폼 코드 (화이트리스트만) */
export function parseExplicitDashboardStorePlatform(
  storeIdParam: string,
): string | null {
  const t = storeIdParam.trim();
  if (!t || !t.includes(":")) return null;
  const p = (t.split(":")[1] ?? "").normalize("NFKC").trim();
  return DASHBOARD_CHIP_PLATFORMS.has(p) ? p : null;
}

/** 대시보드 `storeId` 쿼리에서 매장 UUID만 추출 (all / 복합 id 지원) */
export function extractStoreUuidFromDashboardStoreParam(
  storeIdParam: string,
  allStoresToken: string,
): string | null {
  const t = storeIdParam.trim();
  if (!t || t === allStoresToken) return null;
  const rawFirst = (t.split(":")[0] ?? "").normalize("NFKC").trim();
  const fromFirst = normalizeUuidCandidate(rawFirst);
  if (fromFirst) return fromFirst;
  const m = t.match(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
  );
  return m?.[0]?.toLowerCase() ?? null;
}

/**
 * 플랫폼 칩 활성 기준 (대시보드):
 * - 해당 플랫폼 linked 목록에 store가 존재하고
 * - (external_shop_id가 있거나) 또는 store_platform_shops가 1건 이상 있을 때만
 *
 * NOTE: 세션만 있고 external_shop_id / shops 둘 다 비어있는 "유령 연동"은 비활성 처리.
 */
function storeIsLinkedOnPlatform(
  storeUuid: string,
  stores: StoreWithSessionData[],
): boolean {
  const want = storeUuid.toLowerCase();
  const s = stores.find((x) => x.id.toLowerCase() === want);
  if (!s) return false;
  const hasExternalShopId =
    s.external_shop_id != null && String(s.external_shop_id).trim() !== "";
  const hasShops = (s.platform_shops?.length ?? 0) > 0;
  return hasExternalShopId || hasShops;
}

/** 해당 매장 UUID에 실제 점포 데이터가 있는 플랫폼 id 집합 */
export function getLinkedPlatformIdsForStoreUuid(
  storeUuid: string,
  lists: {
    storesBaemin: StoreWithSessionData[];
    storesCoupangEats: StoreWithSessionData[];
    storesDdangyo: StoreWithSessionData[];
    storesYogiyo: StoreWithSessionData[];
  },
): Set<string> {
  const out = new Set<string>();
  if (storeIsLinkedOnPlatform(storeUuid, lists.storesBaemin)) out.add("baemin");
  if (storeIsLinkedOnPlatform(storeUuid, lists.storesCoupangEats))
    out.add("coupang_eats");
  if (storeIsLinkedOnPlatform(storeUuid, lists.storesDdangyo))
    out.add("ddangyo");
  if (storeIsLinkedOnPlatform(storeUuid, lists.storesYogiyo)) out.add("yogiyo");
  return out;
}

/**
 * 플랫폼 칩 활성 집합.
 * - `storeId`가 `uuid:플랫폼(:…)` 형태면: 해당 플랫폼만 (선택이 특정 플랫폼 점포/그룹을 대표)
 * - `storeId`가 `a:baemin:...,b:yogiyo:...`(콤마 멀티 세그먼트)이면: 포함된 플랫폼만
 * - 순수 UUID면: 해당 store UUID에 연동된 플랫폼을 합산
 */
export function getDashboardChipLinkedPlatforms(
  storeIdParam: string,
  allStoresToken: string,
  lists: {
    storesBaemin: StoreWithSessionData[];
    storesCoupangEats: StoreWithSessionData[];
    storesDdangyo: StoreWithSessionData[];
    storesYogiyo: StoreWithSessionData[];
  },
): Set<string> | null {
  const t = storeIdParam.trim();
  if (!t || t === allStoresToken) return null;

  // 콤마로 여러 세그먼트가 오면 (대시보드 매장 그룹), 그 세그먼트에 포함된 플랫폼만 활성.
  if (t.includes(",")) {
    const out = new Set<string>();
    for (const seg of t.split(",").map((s) => s.trim()).filter(Boolean)) {
      const p = parseExplicitDashboardStorePlatform(seg);
      if (p) out.add(p);
    }
    return out;
  }

  // 단일 세그먼트라도 `uuid:platform(:...)`면 그 플랫폼만 활성.
  const explicit = parseExplicitDashboardStorePlatform(t);
  if (explicit) return new Set([explicit]);

  const uuid = extractStoreUuidFromDashboardStoreParam(t, allStoresToken);
  // 파싱 실패 시 "전부 활성"이 아니라 "전부 비활성"이 더 안전한 기본값.
  // (storeId가 깨져있으면 잘못된 플랫폼 필터 선택/조회로 이어지기 쉬움)
  if (uuid == null) return new Set<string>();

  return getLinkedPlatformIdsForStoreUuid(uuid, lists);
}
