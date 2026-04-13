import { formatKstYmd } from "@/lib/utils/kst-date";
import type {
  BaeminDashboardDailyAggregate,
  BaeminDashboardMenuDailyAggregate,
  BaeminDashboardPersistBundle,
} from "@/lib/dashboard/baemin-dashboard-types";
import type { CoupangEatsOrderConditionItem } from "@/lib/services/coupang-eats/coupang-eats-orders-fetch";

const MENU_NAME_MAX = 500;

function isCoupangOrderCounted(o: CoupangEatsOrderConditionItem): boolean {
  if (o.testOrder === true) return false;
  const st = String(o.status ?? "")
    .trim()
    .toUpperCase();
  if (
    st === "CANCELLED" ||
    st === "CANCELED" ||
    st === "CANCEL" ||
    st === "REFUNDED" ||
    st === "FAILED"
  ) {
    return false;
  }
  return true;
}

function normalizeMenuName(raw: string): string | null {
  const s = raw.replace(/\u00a0/g, " ").trim();
  if (!s) return null;
  return s.length > MENU_NAME_MAX ? s.slice(0, MENU_NAME_MAX) : s;
}

function kstYmdFromCreatedAtMs(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  return formatKstYmd(new Date(ms));
}

type CoupangLineItem = {
  name?: string;
  quantity?: number;
};

function extractLineItems(o: CoupangEatsOrderConditionItem): CoupangLineItem[] {
  const raw = o.items;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is CoupangLineItem => x != null && typeof x === "object");
}

function pickPayAmount(o: CoupangEatsOrderConditionItem): number | null {
  const sp = o.salePrice;
  if (sp != null && Number.isFinite(sp) && sp >= 0) return Math.round(sp);
  const ta = o.totalAmount;
  if (ta != null && Number.isFinite(ta) && ta >= 0) return Math.round(ta);
  return null;
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
 * 쿠팡 order/condition 주문 행 → KST 일·메뉴별 집계 (배민 대시보드 bundle 동형).
 */
export function aggregateCoupangEatsOrderConditionToDashboardBundle(
  orders: readonly CoupangEatsOrderConditionItem[],
): BaeminDashboardPersistBundle {
  const byDay = new Map<string, DayAcc>();

  for (const o of orders) {
    if (!isCoupangOrderCounted(o)) continue;
    const ymd = kstYmdFromCreatedAtMs(
      typeof o.createdAt === "number" ? o.createdAt : undefined,
    );
    if (!ymd) continue;
    const pay = pickPayAmount(o);
    if (pay == null) continue;

    let acc = byDay.get(ymd);
    if (!acc) {
      acc = emptyDay();
      byDay.set(ymd, acc);
    }

    const payRounded = pay;
    acc.orderCount += 1;
    acc.totalPay += payRounded;
    acc.settlementSum += payRounded;

    const items = extractLineItems(o).filter((it) => it.name);
    if (items.length === 0) {
      const nm = normalizeMenuName("(메뉴없음)") ?? "(메뉴없음)";
      acc.totalMenuQty += 1;
      acc.menuQty.set(nm, (acc.menuQty.get(nm) ?? 0) + 1);
      acc.menuLine.set(nm, (acc.menuLine.get(nm) ?? 0) + payRounded);
      continue;
    }

    const qtySum = items.reduce((s, it) => {
      const q =
        it.quantity != null && Number.isFinite(it.quantity) && it.quantity > 0
          ? it.quantity
          : 1;
      return s + q;
    }, 0);

    for (const it of items) {
      const nm = normalizeMenuName(String(it.name));
      if (!nm) continue;
      const q =
        it.quantity != null && Number.isFinite(it.quantity) && it.quantity > 0
          ? Math.floor(it.quantity)
          : 1;
      const line =
        qtySum > 0
          ? Math.round((payRounded * q) / qtySum)
          : Math.round(payRounded / items.length);

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

    const dayRevenue =
      acc.menuLine.size > 0
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
