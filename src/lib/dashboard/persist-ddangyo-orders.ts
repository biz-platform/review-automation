import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateDdangyoOrderListToDashboardBundle } from "@/lib/dashboard/aggregate-ddangyo-dashboard-from-order-list";
import {
  type KstYmdClosedRange,
  kstClosedRangeFromDdangyoOrderListRows,
  mergeKstYmdClosedRanges,
} from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { upsertPlatformDashboardPersistBundle } from "@/lib/dashboard/platform-dashboard-persist";
import {
  type StorePlatformOrderUpsertRow,
  upsertStorePlatformOrdersInChunks,
} from "@/lib/dashboard/upsert-store-platform-orders";
import type { DdangyoOrderListRow } from "@/lib/services/ddangyo/ddangyo-orders-fetch";
import {
  ensureStorePlatformShopsExistForExternalIds,
  getStorePlatformShopRowIdsByExternalIds,
} from "@/lib/services/platform-shop-service";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

const PLATFORM = "ddangyo" as const satisfies PlatformCode;

function ddangyoSettlementToIso(
  setlDt?: string,
  setlTm?: string | number,
): string | null {
  if (!setlDt || !/^\d{8}$/.test(String(setlDt).trim())) return null;
  const d = String(setlDt).trim();
  const tmRaw = setlTm != null ? String(setlTm).replace(/\D/g, "") : "";
  const tm =
    tmRaw.length >= 6
      ? tmRaw.slice(-6)
      : tmRaw.length === 4
        ? `${tmRaw}00`
        : "000000";
  const hh = tm.slice(0, 2);
  const mm = tm.slice(2, 4);
  const ss = tm.slice(4, 6);
  const y = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const t = Date.parse(`${y}T${hh}:${mm}:${ss}+09:00`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

function parseSaleAmtKrw(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

/**
 * 땡겨요 주문 목록 API 행 → `store_platform_orders` upsert.
 */
export async function upsertStorePlatformOrdersFromDdangyoOrderListRows(
  supabase: SupabaseClient,
  storeId: string,
  rows: readonly DdangyoOrderListRow[],
): Promise<{
  upserted: number;
  skipped: number;
  warnings: string[];
  ordersUpsertComplete: boolean;
  /** 유효 주문이 원장에 모두 반영됐거나, 스냅샷이 비어 있음 → 대시보드 갱신 허용 */
  safeToRefreshPlatformDashboard: boolean;
}> {
  const warnings: string[] = [];
  const payload: Omit<StorePlatformOrderUpsertRow, "store_platform_shop_id">[] =
    [];

  for (const row of rows) {
    const ordNo =
      typeof row.ord_no === "string" ? row.ord_no.trim() : String(row.ord_no ?? "").trim();
    if (!ordNo) {
      warnings.push("ord_no 없음 → 스킵");
      continue;
    }
    const patsto =
      typeof row.patsto_no === "string"
        ? row.patsto_no.trim()
        : String(row.patsto_no ?? "").trim();
    if (!patsto) {
      warnings.push(`order ${ordNo}: patsto_no 없음`);
      continue;
    }

    let pay = parseSaleAmtKrw(
      typeof row.sale_amt === "string" ? row.sale_amt : undefined,
    );
    if (pay == null && typeof row.tot_setl_amt === "string") {
      const digits = row.tot_setl_amt.replace(/[^\d]/g, "");
      if (digits) pay = Math.round(Number(digits));
    }
    if (pay == null || !Number.isFinite(pay)) {
      warnings.push(`order ${ordNo}: 금액 파싱 실패`);
      continue;
    }

    const setlDt =
      typeof row.setl_dt === "string" ? row.setl_dt : undefined;
    const setlTm = row.setl_tm as string | number | undefined;
    const orderAt = ddangyoSettlementToIso(setlDt, setlTm);
    if (!orderAt) {
      warnings.push(`order ${ordNo}: setl_dt/setl_tm 파싱 실패`);
      continue;
    }

    payload.push({
      store_id: storeId,
      platform: PLATFORM,
      platform_shop_external_id: patsto,
      order_number: ordNo,
      status:
        typeof row.ord_prog_stat_cd === "string"
          ? row.ord_prog_stat_cd
          : row.ord_prog_stat_cd != null
            ? String(row.ord_prog_stat_cd)
            : null,
      pay_amount: pay,
      order_at: orderAt,
      delivery_type:
        typeof row.ord_tp_nm === "string" ? row.ord_tp_nm : null,
      pay_type:
        typeof row.ord_tp_cd === "string" ? row.ord_tp_cd : null,
      items: {
        menu_nm: row.menu_nm,
        ord_id: row.ord_id,
      },
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
      ? rows.length === 0
      : chunk.upserted === payloadReady.length);

  return {
    upserted: chunk.upserted,
    skipped: Math.max(0, rows.length - payloadReady.length),
    warnings,
    ordersUpsertComplete,
    safeToRefreshPlatformDashboard,
  };
}

/**
 * 점포(`patsto_no`)별 집계 → `store_platform_dashboard_*` (platform=ddangyo).
 */
export async function upsertDdangyoDashboardFromOrderListRowsByShop(
  supabase: SupabaseClient,
  storeId: string,
  rows: readonly DdangyoOrderListRow[],
  options?: {
    /** 동기화 settle 구간 등 — 행에서 날짜를 못 뽑을 때 replace 범위 보강 */
    dashboardReplaceKstRangeFallback?: KstYmdClosedRange | null;
  },
): Promise<
  {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[]
> {
  const byShop = new Map<string, DdangyoOrderListRow[]>();
  for (const row of rows) {
    const patsto =
      typeof row.patsto_no === "string"
        ? row.patsto_no.trim()
        : String(row.patsto_no ?? "").trim();
    if (!patsto) continue;
    const arr = byShop.get(patsto);
    if (arr) arr.push(row);
    else byShop.set(patsto, [row]);
  }

  const out: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[] = [];

  const fb = options?.dashboardReplaceKstRangeFallback ?? null;

  for (const [platformShopExternalId, shopRows] of byShop) {
    const bundle = aggregateDdangyoOrderListToDashboardBundle(shopRows);
    const replaceRange = mergeKstYmdClosedRanges(
      kstClosedRangeFromDdangyoOrderListRows(shopRows),
      fb,
    );
    const persist = await upsertPlatformDashboardPersistBundle(
      supabase,
      storeId,
      PLATFORM,
      platformShopExternalId,
      bundle,
      replaceRange ? { replaceDashboardInKstRange: replaceRange } : {},
    );
    out.push({
      platformShopExternalId,
      dailyRows: bundle.daily.length,
      menuRows: bundle.menus.length,
      dailyError: persist.dailyError,
      menuError: persist.menuError,
    });
  }

  return out;
}

export async function persistDdangyoOrdersSnapshot(args: {
  supabase: SupabaseClient;
  storeId: string;
  rows: readonly DdangyoOrderListRow[];
  /** API settle 창 등 — 행 기반 KST 범위가 비어도 대시보드 replace 적용 */
  dashboardReplaceKstRangeFallback?: KstYmdClosedRange | null;
}): Promise<{
  platformOrdersUpserted: number;
  platformOrdersSkipped: number;
  dashboardByShop: Awaited<
    ReturnType<typeof upsertDdangyoDashboardFromOrderListRowsByShop>
  >;
  warnings: string[];
}> {
  const { supabase, storeId, rows, dashboardReplaceKstRangeFallback } = args;
  const o = await upsertStorePlatformOrdersFromDdangyoOrderListRows(
    supabase,
    storeId,
    rows,
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

  const dashboardByShop = await upsertDdangyoDashboardFromOrderListRowsByShop(
    supabase,
    storeId,
    rows,
    { dashboardReplaceKstRangeFallback },
  );
  const dashWarnings = dashboardByShop.flatMap((d) =>
    [d.dailyError, d.menuError].filter(Boolean),
  ) as string[];
  return {
    platformOrdersUpserted: o.upserted,
    platformOrdersSkipped: o.skipped,
    dashboardByShop,
    warnings: [...o.warnings, ...dashWarnings],
  };
}
