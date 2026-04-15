import type { DashboardSalesData } from "@/entities/dashboard/sales-types";

/** `store_platform_dashboard_menu_daily` 행 최소 필드 */
export type MenuDailyRow = {
  menu_name: string | null;
  quantity: number | null;
  line_total: number | null;
  kst_date: string;
  store_id: string;
  platform: string;
  platform_shop_external_id: string;
};

function buildMenuAggregateMap(
  rows: readonly MenuDailyRow[],
): Map<string, { menuName: string; quantity: number; lineTotal: number }> {
  const map = new Map<
    string,
    { menuName: string; quantity: number; lineTotal: number }
  >();

  for (const r of rows) {
    const name = String(r.menu_name ?? "").trim();
    if (!name) continue;
    const prev = map.get(name) ?? { menuName: name, quantity: 0, lineTotal: 0 };
    const qty = r.quantity ?? 0;
    const total = r.line_total ?? 0;
    map.set(name, {
      menuName: name,
      quantity: prev.quantity + (Number.isFinite(qty) ? qty : 0),
      lineTotal: prev.lineTotal + (Number.isFinite(total) ? total : 0),
    });
  }
  return map;
}

export function aggregateTopMenus(
  currRows: readonly MenuDailyRow[],
  prevRows: readonly MenuDailyRow[],
): DashboardSalesData["topMenus"] {
  const map = buildMenuAggregateMap(currRows);
  const prevMap = buildMenuAggregateMap(prevRows);
  const list = [...map.values()].sort((a, b) => b.lineTotal - a.lineTotal);
  /** 기간 내 전 메뉴 line_total 합 — 비중 분모(상위 N개만이 아님) */
  const totalLineAll = list.reduce((acc, x) => acc + x.lineTotal, 0);
  const top = list.slice(0, 8);
  return top.map((x) => {
    const p = prevMap.get(x.menuName);
    return {
      menuName: x.menuName,
      quantity: x.quantity,
      lineTotal: x.lineTotal,
      shareOfRevenuePercent:
        totalLineAll > 0
          ? Math.round((x.lineTotal / totalLineAll) * 1000) / 10
          : null,
      previousQuantity: p?.quantity ?? 0,
      previousLineTotal: p?.lineTotal ?? 0,
    };
  });
}

export function computeMenuPeriodTotals(rows: readonly MenuDailyRow[]): {
  soldQuantity: number;
  distinctMenuCount: number;
} {
  const map = buildMenuAggregateMap(rows);
  const list = [...map.values()];
  const soldQuantity = list.reduce((a, x) => a + x.quantity, 0);
  return { soldQuantity, distinctMenuCount: list.length };
}
