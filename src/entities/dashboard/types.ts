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
    /** `store_platform_orders` 해당 기간 건수 */
    orderCount: number;
  };
  previous: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCount: number;
  };
  deltas: {
    reviewCount: number;
    avgRating: number | null;
    replyRatePoints: number | null;
    orderCount: number;
  };
  aiSummary: string;
  series: {
    label: string;
    reviewCount: number;
    orderCount: number;
  }[];
  seriesMode: "day" | "week";
  platformBreakdown: {
    platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";
    /** 별점 플랫폼만. 땡겨요 행은 null */
    avgRating: number | null;
    /** 땡겨요만: 기간 내 리뷰 중 맛있어요(rating 5) 비율 %, 그 외 플랫폼은 null */
    tastyRatioPercent: number | null;
    reviewCount: number;
    /** `store_platform_orders` 해당 기간·플랫폼 건수 */
    orderCount: number;
  }[];
  meta: {
    /** 항상 false — 주문 수는 동기화된 주문 테이블 기준 */
    ordersEstimated: false;
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
