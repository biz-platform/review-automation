import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaeminDashboardPersistBundle } from "@/lib/dashboard/baemin-dashboard-types";
import { mergeBaeminReviewCountsIntoDaily } from "@/lib/dashboard/baemin-dashboard-merge-reviews";

type SyncOpts = {
  /** 미전달 시 리뷰 칼럼은 null 로 저장 */
  reviewCountByKst?: ReadonlyMap<string, number>;
  /** 행 단위 기본값. 행에 이미 있으면 유지 */
  defaultSyncStatus?: "complete" | "partial";
  defaultLastError?: string | null;
};

/**
 * 집계 결과를 `store_baemin_dashboard_daily` / `store_baemin_dashboard_menu_daily` 에 upsert.
 * 서비스 롤 클라이언트 사용 권장(워커).
 */
export async function upsertBaeminDashboardPersistBundle(
  supabase: SupabaseClient,
  storeId: string,
  platformShopExternalId: string,
  bundle: BaeminDashboardPersistBundle,
  opts: SyncOpts = {},
): Promise<{ dailyError?: string; menuError?: string }> {
  const shop = String(platformShopExternalId).trim();
  let dailyRows = bundle.daily;
  if (opts.reviewCountByKst) {
    dailyRows = mergeBaeminReviewCountsIntoDaily(
      dailyRows,
      opts.reviewCountByKst,
    );
  }

  const status = opts.defaultSyncStatus ?? "complete";
  const err = opts.defaultLastError ?? null;

  const dailyPayload = dailyRows.map((d) => ({
    store_id: storeId,
    platform_shop_external_id: shop,
    kst_date: d.kstDate,
    order_count: d.orderCount,
    total_pay_amount: d.totalPayAmount,
    settlement_amount: d.settlementAmount,
    avg_order_amount: d.avgOrderAmount,
    total_menu_quantity: d.totalMenuQuantity,
    distinct_menu_count: d.distinctMenuCount,
    review_count: d.reviewCount ?? null,
    review_conversion_ratio: d.reviewConversionRatio ?? null,
    sync_status: d.syncStatus ?? status,
    last_error: d.lastError ?? err,
    updated_at: new Date().toISOString(),
  }));

  const { error: e1 } = await supabase
    .from("store_baemin_dashboard_daily")
    .upsert(dailyPayload, {
      onConflict: "store_id,platform_shop_external_id,kst_date",
    });

  const menuPayload = bundle.menus.map((m) => ({
    store_id: storeId,
    platform_shop_external_id: shop,
    kst_date: m.kstDate,
    menu_name: m.menuName,
    quantity: m.quantity,
    line_total: m.lineTotal,
    share_of_day_revenue: m.shareOfDayRevenue,
    updated_at: new Date().toISOString(),
  }));

  const { error: e2 } =
    menuPayload.length === 0
      ? { error: null as null }
      : await supabase
          .from("store_baemin_dashboard_menu_daily")
          .upsert(menuPayload, {
            onConflict:
              "store_id,platform_shop_external_id,kst_date,menu_name",
          });

  return {
    dailyError: e1?.message,
    menuError: e2?.message,
  };
}
