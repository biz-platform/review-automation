import { formatKstYmd } from "@/lib/utils/kst-date";
import type {
  BaeminDashboardDailyAggregate,
  BaeminDashboardMenuDailyAggregate,
  BaeminDashboardPersistBundle,
  BaeminV4OrderContentRow,
} from "@/lib/dashboard/baemin-dashboard-types";

const CLOSED = "CLOSED";
const MENU_NAME_MAX = 500;

function kstYmdFromOrderAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return formatKstYmd(new Date(t));
}

/** `settle.total` → 없으면 `depositDueAmount` (원, 정수) */
export function resolveBaeminSettlementAmountKrw(
  settle: { total?: number | null; depositDueAmount?: number | null } | undefined,
): number | null {
  if (settle == null) return null;
  const t = settle.total;
  if (t != null && Number.isFinite(t)) return Math.round(t);
  const d = settle.depositDueAmount;
  if (d != null && Number.isFinite(d)) return Math.round(d);
  return null;
}

function normalizeMenuName(raw: string): string | null {
  const s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  return s.length > MENU_NAME_MAX ? s.slice(0, MENU_NAME_MAX) : s;
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
 * v4 `contents[]` 행들을 KST 일·메뉴별로 집계.
 * - `order.status === CLOSED` 만
 * - deliveryType 구분 없음
 * - 메뉴는 `items[].name` 만 (옵션 무시), 라인 금액은 `totalPrice` 합
 */
export function aggregateBaeminV4OrdersToDashboardBundle(
  rows: BaeminV4OrderContentRow[],
): BaeminDashboardPersistBundle {
  const byDay = new Map<string, DayAcc>();

  for (const row of rows) {
    const o = row.order;
    if (!o || o.status !== CLOSED) continue;
    const ymd = kstYmdFromOrderAt(o.orderDateTime);
    if (!ymd) continue;
    const pay = o.payAmount;
    if (pay == null || !Number.isFinite(pay)) continue;

    let acc = byDay.get(ymd);
    if (!acc) {
      acc = emptyDay();
      byDay.set(ymd, acc);
    }

    acc.orderCount += 1;
    acc.totalPay += Math.round(pay);

    const settleAmt = resolveBaeminSettlementAmountKrw(row.settle);
    if (settleAmt != null) acc.settlementSum += settleAmt;

    const items = o.items ?? [];
    for (const it of items) {
      const nm = it.name != null ? normalizeMenuName(String(it.name)) : null;
      if (!nm) continue;
      const q =
        it.quantity != null && Number.isFinite(it.quantity) && it.quantity > 0
          ? Math.floor(it.quantity)
          : 1;
      const line =
        it.totalPrice != null && Number.isFinite(it.totalPrice)
          ? Math.round(it.totalPrice)
          : 0;

      acc.totalMenuQty += q;
      acc.menuQty.set(nm, (acc.menuQty.get(nm) ?? 0) + q);
      acc.menuLine.set(nm, (acc.menuLine.get(nm) ?? 0) + line);
    }
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
      const share =
        dayRevenue > 0 ? line / dayRevenue : null;
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
