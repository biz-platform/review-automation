import { formatKstYmd } from "@/lib/utils/kst-date";
import type {
  BaeminDashboardDailyAggregate,
  BaeminDashboardMenuDailyAggregate,
  BaeminDashboardPersistBundle,
} from "@/lib/dashboard/baemin-dashboard-types";
import type { YogiyoOrderProxyItem } from "@/lib/services/yogiyo/yogiyo-orders-fetch";

const MENU_NAME_MAX = 500;

/** 매출 집계에 포함할 주문 (취소·실패 제외). 실제 API: DELIVERED 등 */
function isYogiyoOrderCounted(o: YogiyoOrderProxyItem): boolean {
  const st = o.transmission_status?.trim().toUpperCase() ?? "";
  if (
    st === "CANCELLED" ||
    st === "CANCELED" ||
    st === "FAILED" ||
    st === "CANCEL"
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

function kstYmdFromSubmittedAt(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const t = Date.parse(`${s.replace(" ", "T")}+09:00`);
  if (Number.isNaN(t)) return null;
  return formatKstYmd(new Date(t));
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
 * 요기요 proxy/orders 주문 → KST 일·메뉴별 집계 (배민 대시보드 스키마와 동일 bundle).
 * - `transmission_status` 가 취소·실패 계열만 제외 (DELIVERED 등 정상 주문 포함)
 * - 라인 금액: `items` 있으면 `order_price` 를 수량 비율로 분배, 없으면 전액을 `(메뉴없음)` 한 줄로
 */
export function aggregateYogiyoProxyOrdersToDashboardBundle(
  orders: readonly YogiyoOrderProxyItem[],
  options?: {
    /**
     * 일자별 정산(순액) override.
     * 없으면 기존과 동일하게 매출(pay)을 정산으로 취급한다.
     */
    settlementAmountByKstYmd?: ReadonlyMap<string, number>;
  },
): BaeminDashboardPersistBundle {
  const byDay = new Map<string, DayAcc>();
  const settlementOverride = options?.settlementAmountByKstYmd ?? null;

  for (const o of orders) {
    if (!isYogiyoOrderCounted(o)) continue;
    const ymd = kstYmdFromSubmittedAt(o.submitted_at);
    if (!ymd) continue;
    const pay = o.order_price;
    if (pay == null || !Number.isFinite(pay) || pay < 0) continue;

    let acc = byDay.get(ymd);
    if (!acc) {
      acc = emptyDay();
      byDay.set(ymd, acc);
    }

    const payRounded = Math.round(pay);
    acc.orderCount += 1;
    acc.totalPay += payRounded;
    if (settlementOverride) {
      // override는 day 1회만 반영되어야 해서, 주문 단위 누적 대신 마지막에 일괄 세팅한다.
      // 여기서는 no-op.
    } else {
      acc.settlementSum += payRounded;
    }

    const items = o.items?.filter((it) => it?.name) ?? [];
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
    const settlementAmount =
      settlementOverride?.get(ymd) ?? acc.settlementSum;
    const avg =
      acc.orderCount > 0
        ? Math.round(acc.totalPay / acc.orderCount)
        : null;
    daily.push({
      kstDate: ymd,
      orderCount: acc.orderCount,
      totalPayAmount: acc.totalPay,
      settlementAmount,
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
