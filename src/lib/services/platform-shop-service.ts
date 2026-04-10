import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

type UpsertPlatformShopInput = {
  platform_shop_external_id: string;
  shop_name?: string | null;
  shop_category?: string | null;
  is_primary?: boolean;
};

/** 동기화 시 매장별 수집 순서: primary 먼저, 그다음 나머지 */
export async function listStorePlatformShopExternalIds(
  supabase: SupabaseClient,
  storeId: string,
  platform: PlatformCode,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("store_platform_shops")
    .select("platform_shop_external_id, is_primary")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .order("is_primary", { ascending: false });

  if (error) throw error;
  const ids = (data ?? [])
    .map((r) => String(r.platform_shop_external_id ?? "").trim())
    .filter((s) => s.length > 0);
  return [...new Set(ids)];
}

export async function upsertStorePlatformShops(
  supabase: SupabaseClient,
  storeId: string,
  platform: PlatformCode,
  shops: UpsertPlatformShopInput[],
): Promise<void> {
  const normalized = shops
    .map((shop) => {
      const platformShopExternalId = shop.platform_shop_external_id?.trim();
      if (!platformShopExternalId) return null;
      const row: {
        store_id: string;
        platform: PlatformCode;
        platform_shop_external_id: string;
        shop_name?: string;
        shop_category?: string;
        is_primary: boolean;
        last_seen_at: string;
        updated_at: string;
      } = {
        store_id: storeId,
        platform,
        platform_shop_external_id: platformShopExternalId,
        is_primary: Boolean(shop.is_primary),
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (shop.shop_name != null && String(shop.shop_name).trim() !== "") {
        row.shop_name = String(shop.shop_name).trim();
      }
      if (shop.shop_category != null && String(shop.shop_category).trim() !== "") {
        row.shop_category = String(shop.shop_category).trim();
      }
      return row;
    })
    .filter((shop): shop is NonNullable<typeof shop> => shop != null);

  if (normalized.length === 0) return;

  const dedup = new Map<string, (typeof normalized)[number]>();
  for (const shop of normalized) {
    dedup.set(shop.platform_shop_external_id, shop);
  }
  const rows = [...dedup.values()];

  const { error } = await supabase
    .from("store_platform_shops")
    .upsert(rows, { onConflict: "store_id,platform,platform_shop_external_id" });

  if (error) throw error;
}

/**
 * `store_platform_orders` 등에서 참조하기 전에, 해당 `platform_shop_external_id`가
 * `store_platform_shops`에 없으면 최소 행만 삽입한다.
 * 이미 있으면 갱신하지 않는다(`is_primary`·`shop_name` 유지).
 */
export async function ensureStorePlatformShopsExistForExternalIds(
  supabase: SupabaseClient,
  storeId: string,
  platform: PlatformCode,
  externalIds: readonly string[],
): Promise<void> {
  const ids = [
    ...new Set(
      externalIds
        .map((s) => String(s ?? "").trim())
        .filter((s) => s.length > 0),
    ),
  ];
  if (ids.length === 0) return;

  const { data: rows, error } = await supabase
    .from("store_platform_shops")
    .select("platform_shop_external_id")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .in("platform_shop_external_id", ids);

  if (error) throw error;
  const have = new Set(
    (rows ?? []).map((r) => String(r.platform_shop_external_id ?? "").trim()),
  );
  const missing = ids.filter((id) => !have.has(id));
  if (missing.length === 0) return;

  await upsertStorePlatformShops(
    supabase,
    storeId,
    platform,
    missing.map((platform_shop_external_id) => ({
      platform_shop_external_id,
      is_primary: false,
    })),
  );
}

/** `platform_shop_external_id` → `store_platform_shops.id` (같은 store·platform 한정) */
export async function getStorePlatformShopRowIdsByExternalIds(
  supabase: SupabaseClient,
  storeId: string,
  platform: PlatformCode,
  externalIds: readonly string[],
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      externalIds
        .map((x) => String(x ?? "").trim())
        .filter((s) => s.length > 0),
    ),
  ];
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("store_platform_shops")
    .select("id, platform_shop_external_id")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .in("platform_shop_external_id", ids);

  if (error) throw error;

  const m = new Map<string, string>();
  for (const r of data ?? []) {
    const ext = String(r.platform_shop_external_id ?? "").trim();
    if (r.id) m.set(ext, String(r.id));
  }
  return m;
}
