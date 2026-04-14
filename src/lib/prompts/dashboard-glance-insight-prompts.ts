export type DashboardGlanceScenario = "positive" | "negative" | "mixed" | "flat";

export const DASHBOARD_GLANCE_SYSTEM_PROMPT = `너는 음식점 사장님을 위한 데이터 분석 리포트를 작성하는 AI야.
아래 [데이터]를 기반으로 2줄짜리 인사이트를 작성해줘.
[탭 유형]: 한눈 요약

[작성 규칙 - 공통]
- 반드시 2문장으로 작성 (각 문장을 줄바꿈으로 구분)
- 1문장: 가장 눈에 띄는 수치 변화 1개를 중심으로 요약
- 2문장: 다른 데이터와 연결해서 변화의 흐름이나 원인을 설명
- 조회 기간이 한 달이면 "지난달 대비", 최근 7일이면 "지난주 대비"로 표현
- 수치는 구체적으로 (%, 건, 점 등 단위 명확하게)
- 어려운 용어가 필요하면 괄호로 바로 설명
- "~했어요", "~있어요", "~보여요", "~것으로 보여요" 어미 사용
- 분석 용어 사용 금지 (예: 상관관계, 유의미한 등)
- 데이터에 없는 내용은 절대 만들지 말 것

[작성 규칙 - 케이스별]
- 긍정: 자연스럽게 좋은 방향으로 해석
- 부정: 원인을 짚되 불안감을 주지 않게, 개선 여지로 마무리
- 혼재: 긍정 수치를 앞세우되, 아쉬운 부분을 자연스럽게 언급
- 유지: 안정적인 흐름임을 긍정적으로 표현, 유지의 의미를 부각`;

export function buildDashboardGlanceInsightUserPrompt(args: {
  startYmd: string;
  endYmd: string;
  rangeLabel: "한 달" | "최근 7일";
  scenarioKorean: "긍정" | "부정" | "혼재" | "유지";
  reviewCount: number;
  reviewDeltaCount: number;
  avgRating: number | null;
  avgRatingDeltaPoints: number | null;
  orderCount: number;
  orderDeltaPercent: number | null;
  platformReviewCounts: {
    baemin: number;
    coupang_eats: number;
    yogiyo: number;
    ddangyo: number;
  };
  platformRatings: {
    baemin: number | null;
    coupang_eats: number | null;
    yogiyo: number | null;
  };
  ddangyoTastyRatioPercent: number | null;
}): string {
  const d = args;
  const orderDelta =
    d.orderDeltaPercent == null
      ? "(비교 불가)"
      : `${d.orderDeltaPercent > 0 ? "+" : ""}${d.orderDeltaPercent.toFixed(1)}%`;
  const ratingDelta =
    d.avgRatingDeltaPoints == null
      ? "(비교 불가)"
      : `${d.avgRatingDeltaPoints > 0 ? "+" : ""}${d.avgRatingDeltaPoints.toFixed(1)}점`;

  const avgRatingStr = d.avgRating == null ? "(없음)" : `${d.avgRating.toFixed(1)}점`;

  const ddangyoTastyStr =
    d.ddangyoTastyRatioPercent == null
      ? "(없음)"
      : `${d.ddangyoTastyRatioPercent.toFixed(0)}%`;

  return `[상황 분류 기준에 따른 현재 상황]: ${d.scenarioKorean}

[데이터]
- 조회 기간: ${d.startYmd} ~ ${d.endYmd} (${d.rangeLabel})
- 리뷰 수: ${d.reviewCount}건 (전 기간 대비 ${d.reviewDeltaCount >= 0 ? "+" : ""}${d.reviewDeltaCount}건)
- 평균 평점: ${avgRatingStr} (전 기간 대비 ${ratingDelta})
- 주문 수: ${d.orderCount}건 (전 기간 대비 ${orderDelta})
- 플랫폼별 리뷰 수: 배달의민족 ${d.platformReviewCounts.baemin}건, 쿠팡이츠 ${d.platformReviewCounts.coupang_eats}건, 요기요 ${d.platformReviewCounts.yogiyo}건, 땡겨요 ${d.platformReviewCounts.ddangyo}건
- 플랫폼별 평점: 배달의민족 ${d.platformRatings.baemin == null ? "(없음)" : `${d.platformRatings.baemin.toFixed(1)}점`}, 쿠팡이츠 ${d.platformRatings.coupang_eats == null ? "(없음)" : `${d.platformRatings.coupang_eats.toFixed(1)}점`}, 요기요 ${d.platformRatings.yogiyo == null ? "(없음)" : `${d.platformRatings.yogiyo.toFixed(1)}점`}
- 땡겨요 만족도: 맛있어요 ${ddangyoTastyStr} (별점 대신 긍정 반응 비율로 표시)

[출력 형식]
첫 번째 문장 1줄
두 번째 문장 1줄`;
}

