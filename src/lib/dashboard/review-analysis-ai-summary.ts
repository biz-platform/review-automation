import type { DashboardReviewAnalysisData } from "@/entities/dashboard/reviews-types";

type SummaryInput = Pick<
  DashboardReviewAnalysisData,
  "totalReviews" | "trend" | "starDistribution" | "keywords"
>;

const TAIL =
  "최근 흐름을 보면 고객 경험에 조금씩 변화가 보이고 있어 주요 키워드를 함께 확인해보시는 걸 추천드려요.";

/**
 * 리뷰 분석 탭 AI 카드용 규칙 기반 문구 (한눈 요약의 Gemini과 별도).
 */
export function buildReviewAnalysisAiSummary(d: SummaryInput): string {
  if (d.totalReviews === 0) {
    return "선택한 기간에 수집된 리뷰가 없어요. 리뷰가 쌓이면 별점·추이·키워드를 함께 확인할 수 있어요.";
  }

  const tr = d.trend;
  let head: string;
  if (tr.length >= 2) {
    const mid = Math.max(1, Math.floor(tr.length / 2));
    const first = tr.slice(0, mid).reduce((s, x) => s + x.reviewCount, 0);
    const second = tr.slice(mid).reduce((s, x) => s + x.reviewCount, 0);
    if (second > first * 1.12 && first > 0) {
      head = "리뷰가 늘면서 고객 반응이 더 활발해지고 있고";
    } else if (first > second * 1.12) {
      head = "최근 구간에서 리뷰 건수에 변화가 보이고";
    } else {
      head = "리뷰와 고객 반응 흐름이 이어지고 있고";
    }
  } else {
    head = "기간 내 리뷰를 살펴보면";
  }

  const negKw = d.keywords.negative.length;
  const lowStarPct = d.starDistribution
    .filter((x) => x.star <= 2)
    .reduce((s, x) => s + x.percent, 0);
  const highStarPct = d.starDistribution
    .filter((x) => x.star >= 4)
    .reduce((s, x) => s + x.percent, 0);

  let body: string;
  if (negKw > 0 || lowStarPct >= 12) {
    body =
      "전반적으로는 긍정적인 평가가 많지만 일부 불만도 함께 나타나고 있어요.";
  } else if (highStarPct >= 65) {
    body = "전반적으로 긍정적인 평가 비중이 높아요.";
  } else {
    body = "만족과 아쉬운 점을 함께 살펴보면 좋아요.";
  }

  if (head.endsWith("고")) {
    return `${head} ${body} ${TAIL}`;
  }

  return `${head} ${body} ${TAIL}`;
}
