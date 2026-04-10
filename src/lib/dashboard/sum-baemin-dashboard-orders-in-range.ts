import type { SupabaseClient } from "@supabase/supabase-js";

export type BaeminDashboardOrderSumFilter =
  | { kind: "store_ids"; storeIds: string[] }
  | {
      kind: "segments_baemin";
      segments: {
        storeId: string;
        platformShopExternalId: string | null;
      }[];
    };

/**
 * `store_baemin_dashboard_daily`: KST 일자 구간 내 order_count 합·행 수.
 * 세그먼트 모드에서는 배민 점포 id가 있는 세그먼트만 메모리 필터 (UUID `or` 문법 회피).
 */
export async function sumBaeminDashboardOrdersInKstRange(
  supabase: SupabaseClient,
  args: {
    startYmd: string;
    endYmd: string;
    /** 단일 점포 필터 (uuid:baemin:14391201) */
    shopExternalIdEq: string | null;
    filter: BaeminDashboardOrderSumFilter;
  },
): Promise<{ sum: number; rowCount: number }> {
  const { startYmd, endYmd, shopExternalIdEq, filter } = args;

  const storeIdsForQuery =
    filter.kind === "store_ids"
      ? filter.storeIds
      : [...new Set(filter.segments.map((s) => s.storeId))];

  if (storeIdsForQuery.length === 0) return { sum: 0, rowCount: 0 };

  let q = supabase
    .from("store_baemin_dashboard_daily")
    .select("order_count, store_id, platform_shop_external_id")
    .gte("kst_date", startYmd)
    .lte("kst_date", endYmd)
    .in("store_id", storeIdsForQuery);

  if (shopExternalIdEq) {
    q = q.eq("platform_shop_external_id", shopExternalIdEq);
  }

  const { data, error } = await q;
  if (error) throw error;

  let rows = data ?? [];

  if (filter.kind === "segments_baemin" && !shopExternalIdEq) {
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
