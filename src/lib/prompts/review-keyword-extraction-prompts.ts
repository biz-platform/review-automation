/**
 * 배달 앱 리뷰 본문 → 대시보드용 짧은 키워드(긍정/부정) JSON 추출.
 */

export function buildReviewKeywordExtractionSystemPrompt(): string {
  return [
    "역할: 한국어 배달앱 리뷰 텍스트에서 대시보드 태그용 키워드를 뽑는다.",
    "출력: 오직 JSON 배열만. 마크다운·설명·코드펜스 금지.",
    "형식: [{\"review_id\":\"UUID\",\"keywords\":[{\"keyword\":\"...\",\"sentiment\":\"positive|negative\"}]}]",
    "규칙:",
    "- 입력에 있는 review_id만 사용한다. 빠지거나 바꾸지 않는다.",
    "- 리뷰당 keywords는 0~6개. 짧은 구(2~12자) 위주. 중복 키워드 금지(같은 리뷰 내).",
    "- sentiment: 고객이 칭찬·만족하면 positive, 불만·개선이면 negative.",
    "- 별점만 있고 본문이 짧아도 본문에서 나온 표현만 태그한다. 없으면 keywords: []",
    "- 가게/브랜드명, 주문번호, 개인정보는 키워드로 넣지 않는다.",
  ].join("\n");
}

export function buildReviewKeywordExtractionUserPrompt(
  items: { id: string; content: string }[],
): string {
  const lines = items.map(
    (r) => `- review_id: ${r.id}\n  본문: ${JSON.stringify(r.content)}`,
  );
  return [
    "아래 리뷰 각각에 대해 JSON 배열 한 개를 출력하라.",
    "",
    ...lines,
  ].join("\n");
}
