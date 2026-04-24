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
import type { DdangyoSettlementRow } from "@/lib/services/ddangyo/ddangyo-settlement-fetch";
import type { DdangyoCalculateDetailAmtRow } from "@/lib/services/ddangyo/ddangyo-calculate-detail-fetch";

const PLATFORM = "ddangyo" as const satisfies PlatformCode;

function compactToKstYmd(compact: string | undefined): string | null {
  if (!compact || !/^\d{8}$/.test(compact.trim())) return null;
  const s = compact.trim();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function parsePaymAmtKrw(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function buildDdangyoSettlementByShopAndDay(args: {
  settlements: readonly DdangyoSettlementRow[];
}): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const s of args.settlements) {
    const patsto =
      typeof s.patsto_no === "string"
        ? s.patsto_no.trim()
        : String(s.patsto_no ?? "").trim();
    if (!patsto) continue;
    const ymd = compactToKstYmd(
      typeof s.paym_plan_dt === "string" ? s.paym_plan_dt : undefined,
    );
    if (!ymd) continue;
    const amt = parsePaymAmtKrw(
      typeof s.paym_amt === "string" ? s.paym_amt : undefined,
    );
    if (amt == null) continue;
    let byDay = out.get(patsto);
    if (!byDay) {
      byDay = new Map<string, number>();
      out.set(patsto, byDay);
    }
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + amt);
  }
  return out;
}

function toIntKrw(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(/,/g, "").trim());
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }
  return null;
}

/**
 * 정산 상세(`requestQryCalculateDetail`) → 점포/주문일자별 정산금액 맵
 * - 우선순위: row.paym_amt (없으면 payn_amt)
 */
function buildDdangyoSettlementDetailByShopAndDay(args: {
  details: readonly DdangyoCalculateDetailAmtRow[];
}): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const r of args.details) {
    const patsto =
      typeof r.patsto_no === "string"
        ? r.patsto_no.trim()
        : String(r.patsto_no ?? "").trim();
    if (!patsto) continue;
    const ymd = compactToKstYmd(typeof r.setl_dt === "string" ? r.setl_dt : undefined);
    if (!ymd) continue;
    const amt = toIntKrw(r.paym_amt) ?? toIntKrw(r.payn_amt);
    if (amt == null || amt <= 0) continue;
    let byDay = out.get(patsto);
    if (!byDay) {
      byDay = new Map<string, number>();
      out.set(patsto, byDay);
    }
    byDay.set(ymd, (byDay.get(ymd) ?? 0) + amt);
  }
  return out;
}

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
      actually_amount: null,
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
    /** 정산(입금) 내역 rows — 있으면 일자별 정산 override */
    settlements?: readonly DdangyoSettlementRow[];
    /** 정산 상세 rows — 있으면 setl_dt(주문일자) 기준으로 정산 override */
    settlementDetails?: readonly DdangyoCalculateDetailAmtRow[];
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
  const detailByShopAndDay =
    options?.settlementDetails && options.settlementDetails.length > 0
      ? buildDdangyoSettlementDetailByShopAndDay({
          details: options.settlementDetails,
        })
      : null;
  const settlementByShopAndDay =
    detailByShopAndDay ??
    (options?.settlements && options.settlements.length > 0
      ? buildDdangyoSettlementByShopAndDay({ settlements: options.settlements })
      : null);

  for (const [platformShopExternalId, shopRows] of byShop) {
    const settlementAmountByKstYmd =
      settlementByShopAndDay?.get(platformShopExternalId) ?? null;
    const bundle = aggregateDdangyoOrderListToDashboardBundle(shopRows, {
      settlementAmountByKstYmd: settlementAmountByKstYmd ?? undefined,
    });
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
  settlements?: readonly DdangyoSettlementRow[];
  settlementDetails?: readonly DdangyoCalculateDetailAmtRow[];
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
  const {
    supabase,
    storeId,
    rows,
    settlements,
    settlementDetails,
    dashboardReplaceKstRangeFallback,
  } = args;
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
    { dashboardReplaceKstRangeFallback, settlements, settlementDetails },
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
