import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateCoupangEatsOrderConditionToDashboardBundle } from "@/lib/dashboard/aggregate-coupang-eats-dashboard-from-order-condition";
import {
  type KstYmdClosedRange,
  kstClosedRangeFromCoupangEatsOrderConditionItems,
  mergeKstYmdClosedRanges,
} from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { upsertPlatformDashboardPersistBundle } from "@/lib/dashboard/platform-dashboard-persist";
import {
  type StorePlatformOrderUpsertRow,
  upsertStorePlatformOrdersInChunks,
} from "@/lib/dashboard/upsert-store-platform-orders";
import type { CoupangEatsOrderConditionItem } from "@/lib/services/coupang-eats/coupang-eats-orders-fetch";
import {
  ensureStorePlatformShopsExistForExternalIds,
  getStorePlatformShopRowIdsByExternalIds,
  upsertStorePlatformShops,
} from "@/lib/services/platform-shop-service";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

const PLATFORM = "coupang_eats" as const satisfies PlatformCode;

function pickPayAmount(o: CoupangEatsOrderConditionItem): number | null {
  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(/,/g, "").trim());
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  };
  const sp = toNum(o.salePrice);
  if (sp != null) return Math.round(sp);
  const ta = toNum(o.totalAmount);
  if (ta != null) return Math.round(ta);
  return null;
}

function pickActuallyAmount(o: CoupangEatsOrderConditionItem): number | null {
  const toNum = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v.replace(/,/g, "").trim());
      if (Number.isFinite(n) && n >= 0) return n;
    }
    return null;
  };
  const pickCompat = (key: string): unknown => {
    const rec = o as unknown as Record<string, unknown>;
    return rec[key];
  };
  const raw =
    o.actuallyAmount ??
    pickCompat("actually_amount") ??
    pickCompat("actuallyAmt") ??
    pickCompat("actually_amt") ??
    null;
  const a = toNum(raw);
  if (a != null) return Math.round(a);
  return null;
}

function orderNumberFrom(o: CoupangEatsOrderConditionItem): string | null {
  const u = o.uniqueOrderId != null ? String(o.uniqueOrderId).trim() : "";
  if (u) return u;
  const id = o.orderId;
  if (id != null && Number.isFinite(Number(id))) return String(id);
  return null;
}

function orderAtIso(o: CoupangEatsOrderConditionItem): string | null {
  const ms = o.createdAt;
  if (ms == null || !Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export async function upsertStorePlatformOrdersFromCoupangEatsOrderItems(
  supabase: SupabaseClient,
  storeId: string,
  orders: readonly CoupangEatsOrderConditionItem[],
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
    const sid = o.storeId ?? o.store?.storeId;
    if (sid == null || !Number.isFinite(Number(sid))) continue;
    const ext = String(Math.trunc(Number(sid)));
    const name = o.store?.storeName?.trim();
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
    const orderNumber = orderNumberFrom(o);
    if (!orderNumber) {
      warnings.push("uniqueOrderId/orderId 없음 → 스킵");
      continue;
    }
    const sid = o.storeId ?? o.store?.storeId;
    if (sid == null || !Number.isFinite(Number(sid))) {
      warnings.push(`order ${orderNumber}: storeId 없음`);
      continue;
    }
    const pay = pickPayAmount(o);
    if (pay == null) {
      warnings.push(`order ${orderNumber}: salePrice/totalAmount 없음`);
      continue;
    }
    const orderAt = orderAtIso(o);
    if (!orderAt) {
      warnings.push(`order ${orderNumber}: createdAt 파싱 실패`);
      continue;
    }
    const actually = pickActuallyAmount(o);

    payload.push({
      store_id: storeId,
      platform: PLATFORM,
      platform_shop_external_id: String(Math.trunc(Number(sid))),
      order_number: orderNumber,
      status: o.status != null ? String(o.status) : null,
      pay_amount: pay,
      actually_amount: actually,
      order_at: orderAt,
      delivery_type: o.type != null ? String(o.type) : null,
      pay_type: null,
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
    const shopRowId = shopRowIds.get(row.platform_shop_external_id);
    if (!shopRowId) {
      warnings.push(
        `store_platform_shops id 없음: platform_shop_external_id=${row.platform_shop_external_id}`,
      );
      continue;
    }
    payloadReady.push({ ...row, store_platform_shop_id: shopRowId });
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

export async function persistCoupangEatsOrdersSnapshot(args: {
  supabase: SupabaseClient;
  storeId: string;
  orders: readonly CoupangEatsOrderConditionItem[];
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

  const o = await upsertStorePlatformOrdersFromCoupangEatsOrderItems(
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

  const byShop = new Map<string, CoupangEatsOrderConditionItem[]>();
  for (const item of orders) {
    const sid = item.storeId ?? item.store?.storeId;
    if (sid == null || !Number.isFinite(Number(sid))) continue;
    const key = String(Math.trunc(Number(sid)));
    const arr = byShop.get(key);
    if (arr) arr.push(item);
    else byShop.set(key, [item]);
  }

  const dashboardByShop: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[] = [];
  const dashWarnings: string[] = [];

  for (const [extId, list] of byShop) {
    const bundle = aggregateCoupangEatsOrderConditionToDashboardBundle(list);
    const replaceRange = mergeKstYmdClosedRanges(
      kstClosedRangeFromCoupangEatsOrderConditionItems(list),
      fb,
    );
    const p = await upsertPlatformDashboardPersistBundle(
      supabase,
      storeId,
      PLATFORM,
      extId,
      bundle,
      replaceRange ? { replaceDashboardInKstRange: replaceRange } : {},
    );
    dashboardByShop.push({
      platformShopExternalId: extId,
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
