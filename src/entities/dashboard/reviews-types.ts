import type { DashboardRange } from "@/entities/dashboard/types";

export type DashboardReviewAnalysisData = {
  range: DashboardRange;
  /** 예: 2026.02.27 - 2026.03.27 */
  periodLabel: string;
  asOfLabel: string;
  /** 리뷰 분석 탭 상단 AI 카드 (규칙 기반 문구) */
  aiSummary: string;
  totalReviews: number;
  /** 별점 플랫폼만 (땡겨요 제외). 없으면 null */
  avgRating: number | null;
  starDistribution: {
    star: 1 | 2 | 3 | 4 | 5;
    count: number;
    percent: number;
  }[];
  trend: {
    label: string;
    reviewCount: number;
    avgRating: number | null;
  }[];
  trendMode: "day" | "week";
  keywords: {
    positive: { keyword: string; reviewCount: number }[];
    negative: { keyword: string; reviewCount: number }[];
  };
};

export type DashboardReviewAnalysisApiRequestData = {
  storeId: string;
  range: DashboardRange;
  platform?: string;
};

export type DashboardReviewKeywordReviewItem = {
  id: string;
  written_at: string | null;
  platform: string;
  rating: number | null;
  content: string | null;
  author_name: string | null;
};

export type DashboardReviewKeywordReviewListData = {
  keyword: string;
  sentiment: "positive" | "negative";
  periodLabel: string;
  reviews: DashboardReviewKeywordReviewItem[];
  count: number;
};

export type DashboardReviewKeywordReviewListApiRequestData = {
  storeId: string;
  range: DashboardRange;
  platform?: string;
  keyword: string;
  sentiment: "positive" | "negative";
};
