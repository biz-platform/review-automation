export type DashboardSalesRange = "7d" | "30d";

export type DashboardSalesData = {
  range: DashboardSalesRange;
  /** 예: 2026.03.01 - 2026.03.07 */
  periodLabel: string;
  /** 예: 2026.03.01 - 2026.03.07 14:00 기준 */
  asOfLabel: string;
  current: {
    orderCount: number;
    totalPayAmount: number;
    settlementAmount: number;
    avgOrderAmount: number | null;
  };
  previous: {
    orderCount: number;
    totalPayAmount: number;
    settlementAmount: number;
    avgOrderAmount: number | null;
  };
  deltas: {
    orderCount: number;
    totalPayAmount: number;
    settlementAmount: number;
    avgOrderAmount: number | null;
  };
  series: {
    label: string;
    orderCount: number;
    totalPayAmount: number;
    settlementAmount: number;
  }[];
  seriesMode: "day" | "week";
  weekdayHourSales: {
    /** 0=월 ... 6=일 (KST 기준) */
    weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    /** 0-23 */
    hour: number;
    /** 주문 수 */
    orderCount: number;
    /** 원 */
    totalPayAmount: number;
  }[];
  topMenus: {
    menuName: string;
    quantity: number;
    lineTotal: number;
    shareOfRevenuePercent: number | null;
  }[];
};

export type DashboardSalesApiRequestData = {
  /**
   * `all` · 단일 매장 UUID · 댓글 관리 전체 플랫폼과 동일한
   * `uuid:플랫폼` / `uuid:플랫폼:platform_shop_external_id`
   */
  storeId: string;
  range: DashboardSalesRange;
  platform?: string;
};

