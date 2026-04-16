export type DashboardRange = "7d" | "30d";

/** 한눈 요약 AI 인사이트 출처 */
export type DashboardGlanceAiInsightSource = "gemini" | "rules" | "static";

/** rules/static일 때만 의미 있음. gemini 성공·캐시 히트(사유 미저장)는 null */
export type DashboardGlanceAiInsightFallbackReason =
  | "missing_gemini_api_key"
  | "gemini_empty_response"
  | "validation_failed"
  | "gemini_error"
  | "resolve_error"
  | "skipped_no_orders";

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
    /** 직전 동일 기간 대비 리뷰 수 증감률(%, 소수 첫째 자리) */
    reviewCount: number;
    avgRating: number | null;
    replyRatePoints: number | null;
    /** 직전 동일 기간 대비 주문 수 증감률(%, 소수 첫째 자리) */
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
    /** 인사이트 문구 생성 출처 */
    aiInsightSource?: DashboardGlanceAiInsightSource;
    /** rules/static 폴백 사유(키 없음·검증 실패 등). gemini·캐시 히트 시 보통 null */
    aiInsightFallbackReason?: DashboardGlanceAiInsightFallbackReason | null;
    /**
     * 개발 환경 디버그용.
     * query `debugAi=1`로 요청했을 때만 내려감.
     */
    aiInsightDebug?: Record<string, unknown> | null;
    /** `dashboard_glance_ai_insights` 히트 여부 */
    aiInsightFromCache?: boolean;
    /** 해당 스코프 매장 `store_platform_orders.updated_at` 최댓값(없으면 null) */
    ordersDataWatermarkAt?: string | null;
    /** 플랫폼 필터가 ddangyo일 때: 전 기간 맛있어요 비율(%) */
    ddangyoPrevTastyRatioPercent?: number | null;
    /** 플랫폼 필터가 ddangyo일 때: 맛있어요 비율 변화(%p). curr - prev */
    ddangyoTastyRatioPoints?: number | null;
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
