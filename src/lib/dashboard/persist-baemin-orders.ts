import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateBaeminV4OrdersToDashboardBundle } from "@/lib/dashboard/aggregate-baemin-dashboard-from-v4-orders";
import { countBaeminReviewsByKstDay } from "@/lib/dashboard/baemin-dashboard-merge-reviews";
import {
  type KstYmdClosedRange,
  kstClosedRangeFromBaeminV4ContentsForShop,
  mergeKstYmdClosedRanges,
} from "@/lib/dashboard/dashboard-order-sync-kst-range";
import type { BaeminV4OrderContentRow } from "@/lib/dashboard/baemin-dashboard-types";
import { upsertPlatformDashboardPersistBundle } from "@/lib/dashboard/platform-dashboard-persist";
import {
  type StorePlatformOrderUpsertRow,
  upsertStorePlatformOrdersInChunks,
} from "@/lib/dashboard/upsert-store-platform-orders";
import {
  ensureStorePlatformShopsExistForExternalIds,
  getStorePlatformShopRowIdsByExternalIds,
} from "@/lib/services/platform-shop-service";
import { kstYmdBoundsUtc } from "@/lib/utils/kst-date";

const PLATFORM = "baemin" as const;

function orderAtIsoForDb(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return null;
    return new Date(t).toISOString();
  }
  const t = Date.parse(`${s}+09:00`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function groupContentsByShop(
  rows: readonly BaeminV4OrderContentRow[],
): Map<string, BaeminV4OrderContentRow[]> {
  const m = new Map<string, BaeminV4OrderContentRow[]>();
  for (const row of rows) {
    const sn = row.order?.shopNumber;
    if (sn == null || !Number.isFinite(Number(sn))) continue;
    const key = String(Math.trunc(Number(sn)));
    const arr = m.get(key);
    if (arr) arr.push(row);
    else m.set(key, [row]);
  }
  return m;
}

export type PersistBaeminV4OrdersSnapshotResult = {
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
};

/**
 * v4 `contents[]` → `store_platform_orders` upsert (건단위).
 * - (store_id, platform, order_number) 충돌 시 갱신
 */
export async function upsertStorePlatformOrdersFromBaeminV4Contents(
  supabase: SupabaseClient,
  storeId: string,
  contents: readonly BaeminV4OrderContentRow[],
): Promise<{
  upserted: number;
  skipped: number;
  warnings: string[];
  ordersUpsertComplete: boolean;
  safeToRefreshPlatformDashboard: boolean;
}> {
  const warnings: string[] = [];
  const payload: Omit<StorePlatformOrderUpsertRow, "store_platform_shop_id">[] =
    [];

  for (const row of contents) {
    const o = row.order;
    if (!o?.orderNumber?.trim()) {
      continue;
    }
    const pay = o.payAmount;
    if (pay == null || !Number.isFinite(pay) || pay < 0) {
      continue;
    }
    const sn = o.shopNumber;
    if (sn == null || !Number.isFinite(Number(sn))) {
      warnings.push(`order ${o.orderNumber}: shopNumber 없음 → 스킵`);
      continue;
    }
    const orderAt = orderAtIsoForDb(o.orderDateTime);
    if (!orderAt) {
      warnings.push(`order ${o.orderNumber}: orderDateTime 파싱 실패`);
      continue;
    }

    payload.push({
      store_id: storeId,
      platform: PLATFORM,
      platform_shop_external_id: String(Math.trunc(Number(sn))),
      order_number: o.orderNumber.trim(),
      status: o.status ?? null,
      pay_amount: Math.round(pay),
      actually_amount: null,
      order_at: orderAt,
      delivery_type: o.deliveryType != null ? String(o.deliveryType) : null,
      pay_type: o.payType != null ? String(o.payType) : null,
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
  if (payloadReady.length !== payload.length) {
    warnings.push(
      `store_platform_orders: shop 행 매칭 실패로 ${payload.length - payloadReady.length}건 제외`,
    );
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
      ? contents.length === 0
      : chunk.upserted === payloadReady.length);

  return {
    upserted: chunk.upserted,
    skipped: Math.max(0, contents.length - payloadReady.length),
    warnings,
    ordersUpsertComplete,
    safeToRefreshPlatformDashboard,
  };
}

/**
 * v4 `contents[]` → 점포(`shopNumber`)별로 집계 후
 * `store_platform_dashboard_daily` / `store_platform_dashboard_menu_daily` upsert.
 */
export async function upsertBaeminDashboardFromV4ContentsByShop(
  supabase: SupabaseClient,
  storeId: string,
  contents: readonly BaeminV4OrderContentRow[],
  opts?: {
    mergeReviewIntoDashboard?: boolean;
    /** v4 조회 KST 구간 — orderDateTime 파싱 실패 시 replace 보강 */
    dashboardReplaceKstRangeFallback?: KstYmdClosedRange | null;
  },
): Promise<
  Pick<PersistBaeminV4OrdersSnapshotResult, "dashboardByShop" | "warnings">
> {
  const warnings: string[] = [];
  const byShop = groupContentsByShop(contents);
  const dashboardByShop: PersistBaeminV4OrdersSnapshotResult["dashboardByShop"] =
    [];

  let reviewRows:
    | { writtenAt: string | null; platformShopExternalId: string | null }[]
    | null = null;

  if (opts?.mergeReviewIntoDashboard) {
    const minYmd = (() => {
      let min: string | null = null;
      for (const row of contents) {
        const iso = row.order?.orderDateTime;
        if (!iso) continue;
        const t = orderAtIsoForDb(iso);
        if (!t) continue;
        const ymd = t.slice(0, 10);
        if (!min || ymd < min) min = ymd;
      }
      return min;
    })();
    const maxYmd = (() => {
      let max: string | null = null;
      for (const row of contents) {
        const iso = row.order?.orderDateTime;
        if (!iso) continue;
        const t = orderAtIsoForDb(iso);
        if (!t) continue;
        const ymd = t.slice(0, 10);
        if (!max || ymd > max) max = ymd;
      }
      return max;
    })();

    if (minYmd && maxYmd) {
      const start = kstYmdBoundsUtc(minYmd, false);
      const end = kstYmdBoundsUtc(maxYmd, true);
      const { data, error } = await supabase
        .from("reviews")
        .select("written_at, platform_shop_external_id")
        .eq("store_id", storeId)
        .eq("platform", PLATFORM)
        .gte("written_at", start.toISOString())
        .lte("written_at", end.toISOString());
      if (error) {
        warnings.push(`reviews 조회(대시보드 병합): ${error.message}`);
      } else {
        reviewRows = (data ?? []).map((r) => ({
          writtenAt: r.written_at as string | null,
          platformShopExternalId: r.platform_shop_external_id as string | null,
        }));
      }
    }
  }

  for (const [platformShopExternalId, shopRows] of byShop) {
    const bundle = aggregateBaeminV4OrdersToDashboardBundle(shopRows);
    let reviewMap: Map<string, number> | undefined;
    if (reviewRows) {
      reviewMap = countBaeminReviewsByKstDay(
        reviewRows,
        platformShopExternalId,
      );
    }

    const replaceRange = mergeKstYmdClosedRanges(
      kstClosedRangeFromBaeminV4ContentsForShop(shopRows),
      opts?.dashboardReplaceKstRangeFallback ?? null,
    );
    const persist = await upsertPlatformDashboardPersistBundle(
      supabase,
      storeId,
      PLATFORM,
      platformShopExternalId,
      bundle,
      {
        ...(reviewMap ? { reviewCountByKst: reviewMap } : {}),
        ...(replaceRange ? { replaceDashboardInKstRange: replaceRange } : {}),
      },
    );

    if (persist.dailyError) warnings.push(persist.dailyError);
    if (persist.menuError) warnings.push(persist.menuError);

    dashboardByShop.push({
      platformShopExternalId,
      dailyRows: bundle.daily.length,
      menuRows: bundle.menus.length,
      dailyError: persist.dailyError,
      menuError: persist.menuError,
    });
  }

  return { dashboardByShop, warnings };
}

/** 플랫폼 주문 행 + 배민 일별·메뉴별 대시보드 테이블까지 한 번에 */
export async function persistBaeminV4OrdersSnapshot(args: {
  supabase: SupabaseClient;
  storeId: string;
  contents: readonly BaeminV4OrderContentRow[];
  mergeReviewIntoDashboard?: boolean;
  dashboardReplaceKstRangeFallback?: KstYmdClosedRange | null;
}): Promise<PersistBaeminV4OrdersSnapshotResult> {
  const {
    supabase,
    storeId,
    contents,
    mergeReviewIntoDashboard,
    dashboardReplaceKstRangeFallback,
  } = args;

  const o = await upsertStorePlatformOrdersFromBaeminV4Contents(
    supabase,
    storeId,
    contents,
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

  const d = await upsertBaeminDashboardFromV4ContentsByShop(
    supabase,
    storeId,
    contents,
    {
      mergeReviewIntoDashboard,
      dashboardReplaceKstRangeFallback,
    },
  );

  return {
    platformOrdersUpserted: o.upserted,
    platformOrdersSkipped: o.skipped,
    dashboardByShop: d.dashboardByShop,
    warnings: [...o.warnings, ...d.warnings],
  };
}
