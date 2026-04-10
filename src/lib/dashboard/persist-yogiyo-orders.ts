import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateYogiyoProxyOrdersToDashboardBundle } from "@/lib/dashboard/aggregate-yogiyo-dashboard-from-proxy-orders";
import {
  type KstYmdClosedRange,
  kstClosedRangeFromYogiyoProxyOrders,
  mergeKstYmdClosedRanges,
} from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { upsertPlatformDashboardPersistBundle } from "@/lib/dashboard/platform-dashboard-persist";
import {
  type StorePlatformOrderUpsertRow,
  upsertStorePlatformOrdersInChunks,
} from "@/lib/dashboard/upsert-store-platform-orders";
import type { YogiyoOrderProxyItem } from "@/lib/services/yogiyo/yogiyo-orders-fetch";
import {
  ensureStorePlatformShopsExistForExternalIds,
  getStorePlatformShopRowIdsByExternalIds,
  upsertStorePlatformShops,
} from "@/lib/services/platform-shop-service";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

const PLATFORM = "yogiyo" as const satisfies PlatformCode;

function submittedAtToIso(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const t = Date.parse(`${s.replace(" ", "T")}+09:00`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

/**
 * 요기요 `proxy/orders` 주문 행 → `store_platform_orders` upsert (`yogiyo-orders-fetch`).
 * `(store_id, platform, order_number)` 충돌 시 갱신.
 */
export async function upsertStorePlatformOrdersFromYogiyoProxyItems(
  supabase: SupabaseClient,
  storeId: string,
  orders: readonly YogiyoOrderProxyItem[],
): Promise<{
  upserted: number;
  skipped: number;
  warnings: string[];
  ordersUpsertComplete: boolean;
  safeToRefreshPlatformDashboard: boolean;
}> {
  const warnings: string[] = [];

  const shopHints = new Map<string, string>();
  for (const o of orders) {
    const ext = String(o.restaurant_id);
    const name = o.restaurant_name?.trim();
    if (name && !shopHints.has(ext)) shopHints.set(ext, name);
  }
  if (shopHints.size > 0) {
    await upsertStorePlatformShops(
      supabase,
      storeId,
      PLATFORM,
      [...shopHints.entries()].map(([platform_shop_external_id, shop_name]) => ({
        platform_shop_external_id,
        shop_name,
        is_primary: false,
      })),
    );
  }

  const payload: Omit<StorePlatformOrderUpsertRow, "store_platform_shop_id">[] =
    [];

  for (const o of orders) {
    const orderNumber = o.order_number?.trim();
    if (!orderNumber) {
      warnings.push("order_number 없음 → 스킵");
      continue;
    }
    const rid = o.restaurant_id;
    if (rid == null || !Number.isFinite(Number(rid))) {
      warnings.push(`order ${orderNumber}: restaurant_id 없음`);
      continue;
    }
    const pay = o.order_price;
    if (pay == null || !Number.isFinite(pay) || pay < 0) {
      warnings.push(`order ${orderNumber}: order_price 없음`);
      continue;
    }
    const orderAt = submittedAtToIso(o.submitted_at);
    if (!orderAt) {
      warnings.push(`order ${orderNumber}: submitted_at 파싱 실패`);
      continue;
    }

    payload.push({
      store_id: storeId,
      platform: PLATFORM,
      platform_shop_external_id: String(Math.trunc(Number(rid))),
      order_number: orderNumber,
      status: o.transmission_status ?? null,
      pay_amount: Math.round(pay),
      order_at: orderAt,
      delivery_type: o.purchase_serving_type ?? null,
      pay_type: o.central_payment_type ?? null,
      items: o.items ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  const shopExternalIds = [...new Set(payload.map((p) => p.platform_shop_external_id))];
  await ensureStorePlatformShopsExistForExternalIds(
    supabase,
    storeId,
    PLATFORM,
    shopExternalIds,
  );

  const shopRowIds = await getStorePlatformShopRowIdsByExternalIds(
    supabase,
    storeId,
    PLATFORM,
    shopExternalIds,
  );

  const payloadReady: StorePlatformOrderUpsertRow[] = [];
  for (const row of payload) {
    const sid = shopRowIds.get(row.platform_shop_external_id);
    if (!sid) {
      warnings.push(
        `store_platform_shops id 없음: platform_shop_external_id=${row.platform_shop_external_id}`,
      );
      continue;
    }
    payloadReady.push({ ...row, store_platform_shop_id: sid });
  }

  const chunk = await upsertStorePlatformOrdersInChunks(
    supabase,
    payloadReady,
    { onWarning: (m) => warnings.push(m) },
  );

  const ordersUpsertComplete = chunk.ordersUpsertComplete;
  const safeToRefreshPlatformDashboard =
    ordersUpsertComplete &&
    (payloadReady.length === 0
      ? orders.length === 0
      : chunk.upserted === payloadReady.length);

  return {
    upserted: chunk.upserted,
    skipped: Math.max(0, orders.length - payloadReady.length),
    warnings,
    ordersUpsertComplete,
    safeToRefreshPlatformDashboard,
  };
}

/**
 * 요기요 proxy/orders 스냅샷 → `store_platform_orders` + 매장별 대시보드 일·메뉴 집계.
 * 워커 `yogiyo_orders_sync` · 로컬 dev 스크립트 공통.
 */
export async function persistYogiyoOrdersSnapshot(args: {
  supabase: SupabaseClient;
  storeId: string;
  orders: readonly YogiyoOrderProxyItem[];
  /** proxy 조회 `date_from`~`date_to` — submitted_at 파싱 실패 시 replace 보강 */
  dashboardReplaceKstRangeFallback?: KstYmdClosedRange | null;
}): Promise<{
  platformOrdersUpserted: number;
  platformOrdersSkipped: number;
  dashboardByShop: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[];
  warnings: string[];
}> {
  const { supabase, storeId, orders, dashboardReplaceKstRangeFallback } = args;
  const fb = dashboardReplaceKstRangeFallback ?? null;

  const o = await upsertStorePlatformOrdersFromYogiyoProxyItems(
    supabase,
    storeId,
    orders,
  );

  if (!o.safeToRefreshPlatformDashboard) {
    const w = [
      ...o.warnings,
      "주문 원장 미반영·미완료 또는 유효 주문 0건(원본 행 있음) → store_platform_dashboard_* 갱신 생략",
    ];
    return {
      platformOrdersUpserted: o.upserted,
      platformOrdersSkipped: o.skipped,
      dashboardByShop: [],
      warnings: w,
    };
  }

  const byRid = new Map<number, YogiyoOrderProxyItem[]>();
  for (const item of orders) {
    const rid = item.restaurant_id;
    if (rid == null || !Number.isFinite(Number(rid))) continue;
    const n = Math.trunc(Number(rid));
    const arr = byRid.get(n);
    if (arr) arr.push(item);
    else byRid.set(n, [item]);
  }

  const dashboardByShop: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[] = [];
  const dashWarnings: string[] = [];

  for (const [rid, list] of byRid) {
    const bundle = aggregateYogiyoProxyOrdersToDashboardBundle(list);
    const replaceRange = mergeKstYmdClosedRanges(
      kstClosedRangeFromYogiyoProxyOrders(list),
      fb,
    );
    const p = await upsertPlatformDashboardPersistBundle(
      supabase,
      storeId,
      PLATFORM,
      String(rid),
      bundle,
      replaceRange ? { replaceDashboardInKstRange: replaceRange } : {},
    );
    dashboardByShop.push({
      platformShopExternalId: String(rid),
      dailyRows: bundle.daily.length,
      menuRows: bundle.menus.length,
      dailyError: p.dailyError,
      menuError: p.menuError,
    });
    if (p.dailyError) dashWarnings.push(p.dailyError);
    if (p.menuError) dashWarnings.push(p.menuError);
  }

  return {
    platformOrdersUpserted: o.upserted,
    platformOrdersSkipped: o.skipped,
    dashboardByShop,
    warnings: [...o.warnings, ...dashWarnings],
  };
}
