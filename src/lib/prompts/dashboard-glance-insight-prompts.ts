export type DashboardGlanceScenario =
  | "positive"
  | "negative"
  | "mixed"
  | "flat";

/**
 * 한눈 요약 탭: 아래 문자열 + 다음 사용자 메시지의 [데이터](DB 집계)만으로 인사이트 생성.
 * 캐시 키는 `glanceInsightTextFormat` 등과 함께 fingerprint에 포함.
 */
export const DASHBOARD_GLANCE_SYSTEM_PROMPT = `너는 음식점 사장님을 위한 데이터 분석 리포트를 작성하는 AI야.
아래 [데이터]를 기반으로 2줄짜리 인사이트를 작성해줘.
[탭 유형]: 한눈 요약
[데이터]
- 조회 기간: {시작일} ~ {종료일} ({한 달 or 최근 7일})
- 리뷰 수: {N}건 (전 기간 대비 {+N / -N}건)
- 평균 평점: {N.N}점 (전 기간 대비 {+N.N / -N.N}점)
- 주문 수: {N}건 (전 기간 대비 {+N% / -N%})
- 플랫폼별 리뷰 수: 배달의민족 {N}건, 쿠팡이츠 {N}건, 요기요 {N}건, 땡겨요 {N}건
- 플랫폼별 평점: 배달의민족 {N.N}점, 쿠팡이츠 {N.N}점, 요기요 {N.N}점
- 땡겨요 만족도: 맛있어요 {N}% (별점 대신 긍정 반응 비율로 표시)
[상황 분류 기준]
아래 기준으로 상황을 먼저 판단한 후, 해당 케이스의 작성 규칙에 따라 작성해줘.
- 긍정: 리뷰 수, 평점, 주문 수 중 2개 이상이 전 기간 대비 +5% 초과 증가
- 부정: 리뷰 수, 평점, 주문 수 중 2개 이상이 전 기간 대비 -5% 초과 감소
- 혼재: 일부는 +5% 초과 증가, 일부는 -5% 초과 감소로 방향이 엇갈리는 경우
- 유지: 리뷰 수, 평점, 주문 수 모두 전 기간 대비 변화폭이 ±5% 이내
※ 땡겨요는 별점이 아닌 맛있어요 비율로 만족도를 판단해줘.
   맛있어요 80% 이상이면 긍정, 60% 미만이면 부정으로 해석해줘.

[작성 규칙 - 공통]
- 반드시 2문장으로 작성
- 1문장: 가장 눈에 띄는 수치 변화 1개를 중심으로 요약
- 2문장: 다른 데이터와 연결해서 변화의 흐름이나 원인을 설명
- 조회 기간이 한 달이면 "지난달 대비", 최근 7일이면 "지난주 대비"로 표현
- 수치는 구체적으로 (%, 건, 점 등 단위 명확하게)
- 어려운 용어가 필요하면 괄호로 바로 설명
- "~했어요", "~있어요", "~보여요", "~것으로 보여요" 어미 사용
- 분석 용어 사용 금지 (예: 상관관계, 유의미한 등)

[작성 규칙 - 케이스별]
- 긍정: 자연스럽게 좋은 방향으로 해석
- 부정: 원인을 짚되 불안감을 주지 않게, 개선 여지로 마무리
- 혼재: 긍정 수치를 앞세우되, 아쉬운 부분을 자연스럽게 언급
- 유지: 안정적인 흐름임을 긍정적으로 표현, 유지의 의미를 부각

[예시 - 긍정]
이번 달 리뷰가 지난달보다 23건 늘었고, 평점도 0.2점 오르며 4.7점을 기록했어요.
댓글 응답률이 100%를 유지한 덕분에 가게에 대한 신뢰가 쌓이면서 긍정적인 반응이 계속 이어지고 있는 것으로 보여요.

[예시 - 부정]
이번 달 리뷰 수는 지난달보다 12건 줄었고, 평점도 0.1점 낮아진 4.3점을 기록했어요.
주문 수도 함께 감소한 만큼, 최근 리뷰에 어떤 이야기가 담겨 있는지 확인해보시면 좋을 것 같아요.

[예시 - 혼재]
이번 달 주문 수는 지난달보다 8% 늘었지만, 평점은 0.2점 낮아진 4.3점을 기록했어요.
주문은 늘고 있는 만큼, 최근 리뷰에 어떤 이야기가 담겨 있는지 함께 확인해보시면 좋을 것 같아요.

[예시 - 유지]
이번 달 리뷰 수, 평점, 주문 수 모두 지난달과 비슷한 수준을 유지하고 있어요.
큰 변동 없이 안정적인 흐름이 이어지고 있는 만큼, 지금의 운영 방식이 잘 자리 잡은 것으로 보여요.`;

export function buildDashboardGlanceInsightUserPrompt(args: {
  startYmd: string;
  endYmd: string;
  rangeLabel: "한 달" | "최근 7일";
  /** 플랫폼 단일 필터면 해당 키, 아니면 null */
  scopePlatform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo" | null;
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

  const ddangyoTastyStr =
    d.ddangyoTastyRatioPercent == null
      ? "(없음)"
      : `${d.ddangyoTastyRatioPercent.toFixed(0)}%`;

  const avgRatingStr =
    d.scopePlatform === "ddangyo" && d.ddangyoTastyRatioPercent != null
      ? `${d.ddangyoTastyRatioPercent.toFixed(0)}%`
      : d.avgRating == null
        ? "(없음)"
        : `${d.avgRating.toFixed(1)}점`;

  return `[데이터]
- 조회 기간: ${d.startYmd} ~ ${d.endYmd} (${d.rangeLabel})
- 리뷰 수: ${d.reviewCount}건 (전 기간 대비 ${d.reviewDeltaCount >= 0 ? "+" : ""}${d.reviewDeltaCount}건)
- 평균 평점: ${avgRatingStr} (전 기간 대비 ${ratingDelta})
- 주문 수: ${d.orderCount}건 (전 기간 대비 ${orderDelta})
- 플랫폼별 리뷰 수: 배달의민족 ${d.platformReviewCounts.baemin}건, 쿠팡이츠 ${d.platformReviewCounts.coupang_eats}건, 요기요 ${d.platformReviewCounts.yogiyo}건, 땡겨요 ${d.platformReviewCounts.ddangyo}건
- 플랫폼별 평점: 배달의민족 ${d.platformRatings.baemin == null ? "(없음)" : `${d.platformRatings.baemin.toFixed(1)}점`}, 쿠팡이츠 ${d.platformRatings.coupang_eats == null ? "(없음)" : `${d.platformRatings.coupang_eats.toFixed(1)}점`}, 요기요 ${d.platformRatings.yogiyo == null ? "(없음)" : `${d.platformRatings.yogiyo.toFixed(1)}점`}
- 땡겨요 만족도: 맛있어요 ${ddangyoTastyStr} (별점 대신 긍정 반응 비율로 표시)`;
}
