import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

export type PlatformDashboardOrderSumFilter =
  | { kind: "store_ids"; storeIds: string[] }
  | {
      kind: "segments";
      segments: {
        storeId: string;
        platformShopExternalId: string | null;
      }[];
    };

/** @deprecated `PlatformDashboardOrderSumFilter` 사용 */
export type BaeminDashboardOrderSumFilter = PlatformDashboardOrderSumFilter;

/**
 * `store_platform_dashboard_daily`: KST 일자 구간 내 order_count 합·행 수.
 * 세그먼트 모드에서는 점포 id가 있는 세그먼트만 메모리 필터 (UUID `or` 문법 회피).
 */
export async function sumPlatformDashboardOrdersInKstRange(
  supabase: SupabaseClient,
  args: {
    platform?: PlatformCode;
    startYmd: string;
    endYmd: string;
    /** 단일 점포 필터 */
    shopExternalIdEq: string | null;
    filter: PlatformDashboardOrderSumFilter;
  },
): Promise<{ sum: number; rowCount: number }> {
  const platform = args.platform ?? "baemin";
  const { startYmd, endYmd, shopExternalIdEq, filter } = args;

  const storeIdsForQuery =
    filter.kind === "store_ids"
      ? filter.storeIds
      : [...new Set(filter.segments.map((s) => s.storeId))];

  if (storeIdsForQuery.length === 0) return { sum: 0, rowCount: 0 };

  let q = supabase
    .from("store_platform_dashboard_daily")
    .select("order_count, store_id, platform_shop_external_id, platform")
    .eq("platform", platform)
    .gte("kst_date", startYmd)
    .lte("kst_date", endYmd)
    .in("store_id", storeIdsForQuery);

  if (shopExternalIdEq) {
    q = q.eq("platform_shop_external_id", shopExternalIdEq);
  }

  const { data, error } = await q;
  if (error) throw error;

  let rows = data ?? [];

  if (filter.kind === "segments" && !shopExternalIdEq) {
    rows = rows.filter((r) => {
      const sid = String(r.store_id);
      const shop = String(r.platform_shop_external_id);
      for (const s of filter.segments) {
        if (s.storeId !== sid) continue;
        const want = s.platformShopExternalId?.trim();
        if (!want) return true;
        if (want === shop) return true;
      }
      return false;
    });
  }

  let sum = 0;
  for (const r of rows) {
    const n = r.order_count;
    if (n != null && Number.isFinite(n)) sum += n;
  }
  return { sum, rowCount: rows.length };
}

/** @deprecated `sumPlatformDashboardOrdersInKstRange` 사용 */
export async function sumBaeminDashboardOrdersInKstRange(
  supabase: SupabaseClient,
  args: {
    startYmd: string;
    endYmd: string;
    shopExternalIdEq: string | null;
    filter:
      | BaeminDashboardOrderSumFilter
      | { kind: "segments_baemin"; segments: { storeId: string; platformShopExternalId: string | null }[] };
  },
): Promise<{ sum: number; rowCount: number }> {
  const f = args.filter;
  const normalized: PlatformDashboardOrderSumFilter =
    f.kind === "segments_baemin"
      ? { kind: "segments", segments: f.segments }
      : f;
  return sumPlatformDashboardOrdersInKstRange(supabase, {
    platform: "baemin",
    startYmd: args.startYmd,
    endYmd: args.endYmd,
    shopExternalIdEq: args.shopExternalIdEq,
    filter: normalized,
  });
}
