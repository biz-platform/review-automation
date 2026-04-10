import type {
  BaeminDashboardDailyAggregate,
  BaeminDashboardMenuDailyAggregate,
  BaeminDashboardPersistBundle,
} from "@/lib/dashboard/baemin-dashboard-types";
import type { DdangyoOrderListRow } from "@/lib/services/ddangyo/ddangyo-orders-fetch";

const MENU_NAME_MAX = 500;

function normalizeMenuName(raw: string): string | null {
  const s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  return s.length > MENU_NAME_MAX ? s.slice(0, MENU_NAME_MAX) : s;
}

/** `YYYYMMDD` compact → `YYYY-MM-DD` (KST 달력일) */
function compactSetlDtToKstYmd(compact: string | undefined): string | null {
  if (!compact || !/^\d{8}$/.test(compact.trim())) return null;
  const s = compact.trim();
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function parseSaleAmtKrw(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(String(raw).replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

type DayAcc = {
  orderCount: number;
  totalPay: number;
  settlementSum: number;
  totalMenuQty: number;
  menuQty: Map<string, number>;
  menuLine: Map<string, number>;
};

function emptyDay(): DayAcc {
  return {
    orderCount: 0,
    totalPay: 0,
    settlementSum: 0,
    totalMenuQty: 0,
    menuQty: new Map(),
    menuLine: new Map(),
  };
}

/**
 * 땡겨요 주문 목록 API 행 → KST 일·메뉴별 집계.
 * - 행 단위 = 주문 1건(표시 메뉴 요약은 `menu_nm`)
 * - 금액: `sale_amt` 우선, 없으면 `tot_setl_amt` 에서 숫자만
 */
export function aggregateDdangyoOrderListToDashboardBundle(
  rows: readonly DdangyoOrderListRow[],
): BaeminDashboardPersistBundle {
  const byDay = new Map<string, DayAcc>();

  for (const row of rows) {
    const ymd = compactSetlDtToKstYmd(
      typeof row.setl_dt === "string" ? row.setl_dt : undefined,
    );
    if (!ymd) continue;

    let pay = parseSaleAmtKrw(
      typeof row.sale_amt === "string" ? row.sale_amt : undefined,
    );
    if (pay == null && typeof row.tot_setl_amt === "string") {
      const digits = row.tot_setl_amt.replace(/[^\d]/g, "");
      if (digits) pay = Math.round(Number(digits));
    }
    if (pay == null || !Number.isFinite(pay)) continue;

    let acc = byDay.get(ymd);
    if (!acc) {
      acc = emptyDay();
      byDay.set(ymd, acc);
    }

    acc.orderCount += 1;
    acc.totalPay += pay;
    acc.settlementSum += pay;

    const nm =
      normalizeMenuName(
        typeof row.menu_nm === "string" ? row.menu_nm : "",
      ) ?? "(메뉴없음)";
    const q = 1;
    acc.totalMenuQty += q;
    acc.menuQty.set(nm, (acc.menuQty.get(nm) ?? 0) + q);
    acc.menuLine.set(nm, (acc.menuLine.get(nm) ?? 0) + pay);
  }

  const daily: BaeminDashboardDailyAggregate[] = [];
  const menus: BaeminDashboardMenuDailyAggregate[] = [];

  const sortedDays = [...byDay.keys()].sort();
  for (const ymd of sortedDays) {
    const acc = byDay.get(ymd)!;
    const avg =
      acc.orderCount > 0
        ? Math.round(acc.totalPay / acc.orderCount)
        : null;
    daily.push({
      kstDate: ymd,
      orderCount: acc.orderCount,
      totalPayAmount: acc.totalPay,
      settlementAmount: acc.settlementSum,
      avgOrderAmount: avg,
      totalMenuQuantity: acc.totalMenuQty,
      distinctMenuCount: acc.menuQty.size,
    });

    const dayRevenue = acc.menuLine.size > 0
      ? [...acc.menuLine.values()].reduce((a, b) => a + b, 0)
      : 0;

    const names = [...acc.menuQty.keys()].sort();
    for (const name of names) {
      const qty = acc.menuQty.get(name) ?? 0;
      const line = acc.menuLine.get(name) ?? 0;
      const share = dayRevenue > 0 ? line / dayRevenue : null;
      menus.push({
        kstDate: ymd,
        menuName: name,
        quantity: qty,
        lineTotal: line,
        shareOfDayRevenue: share,
      });
    }
  }

  return { daily, menus };
}
