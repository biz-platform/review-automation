export type DashboardRange = "7d" | "30d";

export type DashboardGlanceData = {
  range: DashboardRange;
  /** 예: 2026.03.01 - 2026.03.07 */
  periodLabel: string;
  /** 예: 2026.03.01 - 2026.03.07 14:00 기준 */
  asOfLabel: string;
  current: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCountEstimated: number;
  };
  previous: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCountEstimated: number;
  };
  deltas: {
    reviewCount: number;
    avgRating: number | null;
    replyRatePoints: number | null;
    orderCountEstimated: number;
  };
  aiSummary: string;
  series: {
    label: string;
    reviewCount: number;
    orderCountEstimated: number;
  }[];
  seriesMode: "day" | "week";
  platformBreakdown: {
    platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";
    avgRating: number | null;
    reviewCount: number;
    orderCountEstimated: number;
  }[];
  meta: {
    ordersEstimated: boolean;
    estimateRatio: number;
  };
};

export type DashboardGlanceApiRequestData = {
  /**
   * `all` · 단일 매장 UUID · 댓글 관리 전체 플랫폼과 동일한
   * `uuid:플랫폼` / `uuid:플랫폼:platform_shop_external_id`
   */
  storeId: string;
  range: DashboardRange;
  platform?: string;
};

