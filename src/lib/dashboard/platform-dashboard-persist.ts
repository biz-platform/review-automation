import type { SupabaseClient } from "@supabase/supabase-js";
import type { BaeminDashboardPersistBundle } from "@/lib/dashboard/baemin-dashboard-types";
import type { KstYmdClosedRange } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { mergeBaeminReviewCountsIntoDaily } from "@/lib/dashboard/baemin-dashboard-merge-reviews";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

type SyncOpts = {
  /** 배민 전용: 리뷰 수를 일별 행에 합산. 다른 플랫폼은 무시 */
  reviewCountByKst?: ReadonlyMap<string, number>;
  defaultSyncStatus?: "complete" | "partial";
  defaultLastError?: string | null;
  /**
   * 스냅샷 동기화 시: 해당 점포·KST 구간의 기존 대시보드 행을 먼저 삭제한 뒤 upsert.
   * (유령 menu_daily / 과거 daily 제거 — 원장과 집계 범위 정합)
   */
  replaceDashboardInKstRange?: KstYmdClosedRange | null;
};

/**
 * 점포·플랫폼·KST 구간의 대시보드 집계 행 삭제 (menu → daily 순).
 */
export async function deleteStorePlatformDashboardForShopInKstRange(
  supabase: SupabaseClient,
  args: {
    storeId: string;
    platform: PlatformCode;
    platformShopExternalId: string;
    range: KstYmdClosedRange;
  },
): Promise<{ menuError?: string; dailyError?: string }> {
  const shop = String(args.platformShopExternalId).trim();
  const { startYmd, endYmd } = args.range;
  if (!shop || startYmd > endYmd) return {};

  const base = supabase
    .from("store_platform_dashboard_menu_daily")
    .delete()
    .eq("store_id", args.storeId)
    .eq("platform", args.platform)
    .eq("platform_shop_external_id", shop)
    .gte("kst_date", startYmd)
    .lte("kst_date", endYmd);

  const { error: eMenu } = await base;

  const { error: eDaily } = await supabase
    .from("store_platform_dashboard_daily")
    .delete()
    .eq("store_id", args.storeId)
    .eq("platform", args.platform)
    .eq("platform_shop_external_id", shop)
    .gte("kst_date", startYmd)
    .lte("kst_date", endYmd);

  return {
    menuError: eMenu?.message,
    dailyError: eDaily?.message,
  };
}

/**
 * 집계 결과 → `store_platform_dashboard_daily` / `store_platform_dashboard_menu_daily` upsert.
 * 서비스 롤 클라이언트 사용 권장(워커).
 */
export async function upsertPlatformDashboardPersistBundle(
  supabase: SupabaseClient,
  storeId: string,
  platform: PlatformCode,
  platformShopExternalId: string,
  bundle: BaeminDashboardPersistBundle,
  opts: SyncOpts = {},
): Promise<{ dailyError?: string; menuError?: string }> {
  const shop = String(platformShopExternalId).trim();
  const replace = opts.replaceDashboardInKstRange;
  if (
    replace &&
    replace.startYmd &&
    replace.endYmd &&
    replace.startYmd <= replace.endYmd
  ) {
    const del = await deleteStorePlatformDashboardForShopInKstRange(supabase, {
      storeId,
      platform,
      platformShopExternalId: shop,
      range: replace,
    });
    if (del.menuError || del.dailyError) {
      return {
        dailyError: del.dailyError,
        menuError: del.menuError,
      };
    }
  }

  let dailyRows = bundle.daily;
  if (opts.reviewCountByKst && platform === "baemin") {
    dailyRows = mergeBaeminReviewCountsIntoDaily(
      dailyRows,
      opts.reviewCountByKst,
    );
  }

  const status = opts.defaultSyncStatus ?? "complete";
  const err = opts.defaultLastError ?? null;

  const dailyPayload = dailyRows.map((d) => ({
    store_id: storeId,
    platform,
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
    .from("store_platform_dashboard_daily")
    .upsert(dailyPayload, {
      onConflict: "store_id,platform,platform_shop_external_id,kst_date",
    });

  const menuPayload = bundle.menus.map((m) => ({
    store_id: storeId,
    platform,
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
          .from("store_platform_dashboard_menu_daily")
          .upsert(menuPayload, {
            onConflict:
              "store_id,platform,platform_shop_external_id,kst_date,menu_name",
          });

  return {
    dailyError: e1?.message,
    menuError: e2?.message,
  };
}
