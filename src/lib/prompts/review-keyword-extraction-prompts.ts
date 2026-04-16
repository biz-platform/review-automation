/**
 * 배달 앱 리뷰 본문 → 대시보드용 정형 키워드(긍정/부정 + 카테고리 + canonical) JSON 추출.
 */

export function buildReviewKeywordExtractionSystemPrompt(): string {
  const allowed = [
    "허용 canonicalKeyword 목록(아래 중에서만 선택할 것. 새 키워드 생성 금지):",
    "",
    "[positive]",
    "- taste: 맛있어요, 간이 맞아요, 맛이 변함없어요, 고소해요, 담백해요, 진해요, 시원해요, 쫄깃해요, 부드러워요, 독특해요, 바삭해요, 신선해요, 양념, 촉촉해요, 매콤해요, 잡내가 없어요, 깔끔해요",
    "- quantity_price: 양 많아요, 합리적이에요, 구성이 알차요, 든든해요, 푸짐해요",
    "- packaging_delivery: 포장이 깔끔해요, 빠른 배달, 따뜻해요, 사진과 같아요, 정성, 서비스, 친절",
    "- revisit_recommend: 재주문 예정, 단골, 주변 추천",
    "- context: 해장, 혼밥, 가족, 친구, 아이, 어른들, 안주, 야식, 회식, 파티, 야근, 추운 날, 더운 날, 기분 전환",
    "",
    "[negative]",
    "- taste: 맛이 없어요, 짜요, 싱거워요, 느끼해요, 퍼졌어요, 비려요, 맛이 달라졌어요, 질겨요, 위생 문제, 이물질, 눅눅해요, 딱딱해요, 간이 안 맞아요, 덜 익었어요, 매워요, 상했어요, 두꺼워요, 얇아요, 퍽퍽해요, 탔어요, 끈적해요, 냄새가 안 좋아요",
    "- quantity_price: 양이 적어요, 비싸요, 부실해요",
    "- packaging_delivery: 포장 불량, 배달 지연, 메뉴 누락, 오배송, 불친절, 식었어요, 녹았어요, 불었어요, 요청사항 누락, 사진과 달라요, 수저 누락, 리뷰이벤트 누락",
    "- revisit_recommend: 재주문 안해요, 실망, 주변에 비추해요, 아쉬워요, 옵션 추가 요청",
    "",
    "주의: 위 리스트에 없으면 keywords에서 제외한다(억지로 끼워넣지 말 것).",
  ].join("\n");

  return [
    "역할: 한국어 배달앱 리뷰 텍스트에서 대시보드 태그용 키워드를 뽑는다.",
    "출력: 오직 JSON 배열만. 마크다운·설명·코드펜스 금지.",
    "형식: [{\"review_id\":\"UUID\",\"keywords\":[{\"canonicalKeyword\":\"...\",\"category\":\"taste|quantity_price|packaging_delivery|revisit_recommend|context\",\"sentiment\":\"positive|negative\",\"alias\":\"...\"}]}]",
    "규칙:",
    "- 입력에 있는 review_id만 사용한다. 빠지거나 바꾸지 않는다.",
    "- 리뷰당 keywords는 0~6개.",
    "- canonicalKeyword: 반드시 '허용 canonicalKeyword 목록' 중에서만 선택한다. (새 키워드 생성 금지)",
    "- category는 아래 5개 중 하나로만 분류한다:",
    "  - taste(맛/식감/간/신선/위생/이물질/상함/냄새 포함)",
    "  - quantity_price(양/가격/구성/가성비)",
    "  - packaging_delivery(포장/배달/누락/오배송/요청사항/온도/서비스/친절)",
    "  - revisit_recommend(재주문/재방문/추천/단골/비추/실망)",
    "  - context(상황/맥락: 해장/혼밥/야식/회식 등)",
    "- sentiment: 고객이 칭찬·만족하면 positive, 불만·개선이면 negative.",
    "- alias: 본문에서 실제로 사용된 표현(10~30자 권장). canonicalKeyword와 의미가 같아야 한다.",
    "- 같은 리뷰 내 중복 금지: (sentiment, canonicalKeyword) 기준으로 1회만.",
    "- 별점만 있고 본문이 짧아도 본문에서 나온 표현만 태그한다. 없으면 keywords: []",
    "- 가게/브랜드명, 주문번호, 개인정보는 키워드로 넣지 않는다.",
    "",
    allowed,
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
