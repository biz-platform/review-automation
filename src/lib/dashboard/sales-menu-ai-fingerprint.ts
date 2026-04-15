import { createHash } from "node:crypto";
import type { DashboardSalesData } from "@/entities/dashboard/sales-types";

export function buildSalesDashboardAiFingerprint(payload: {
  range: "7d" | "30d";
  current: DashboardSalesData["current"];
  previous: DashboardSalesData["previous"];
  deltas: DashboardSalesData["deltas"];
  weekdayHourSales: DashboardSalesData["weekdayHourSales"];
}): string {
  const weekdayBuckets = Array.from({ length: 7 }, (_, i) => {
    let pay = 0;
    let oc = 0;
    for (const r of payload.weekdayHourSales) {
      if (r.weekday !== i) continue;
      pay += r.totalPayAmount;
      oc += r.orderCount;
    }
    return { w: i, pay, oc };
  });
  const normalized = {
    /** 규칙 문구/줄바꿈 포맷 바뀌면 버전 올려 캐시 무효화 */
    salesInsightTextFormat: 2,
    range: payload.range,
    current: payload.current,
    previous: payload.previous,
    deltas: payload.deltas,
    weekdayBuckets,
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

export function buildMenuDashboardAiFingerprint(payload: {
  range: "7d" | "30d";
  menuPeriodMetrics: DashboardSalesData["menuPeriodMetrics"];
  topMenus: DashboardSalesData["topMenus"];
}): string {
  const top = (payload.topMenus ?? []).slice(0, 25).map((m) => ({
    menuName: m.menuName,
    quantity: m.quantity,
    lineTotal: m.lineTotal,
    shareOfRevenuePercent: m.shareOfRevenuePercent,
    previousQuantity: m.previousQuantity,
    previousLineTotal: m.previousLineTotal,
  }));
  return createHash("sha256")
    .update(
      JSON.stringify({
        range: payload.range,
        menuPeriodMetrics: payload.menuPeriodMetrics,
        topMenus: top,
      }),
    )
    .digest("hex");
}
