export type ReviewKeywordSentiment = "positive" | "negative";

export type ReviewKeywordCategory =
  | "taste"
  | "quantity_price"
  | "packaging_delivery"
  | "revisit_recommend"
  | "context";

/**
 * 설계서 canonical 키워드 (source of truth)
 * - Gemini 출력/DB 저장/대시보드 집계 모두 이 리스트 기준으로만 canonical을 허용한다.
 */
export const REVIEW_KEYWORD_CANONICALS: Record<
  ReviewKeywordSentiment,
  Record<ReviewKeywordCategory, readonly string[]>
> = {
  positive: {
    taste: [
      "맛있어요",
      "간이 맞아요",
      "맛이 변함없어요",
      "고소해요",
      "담백해요",
      "진해요",
      "시원해요",
      "쫄깃해요",
      "부드러워요",
      "독특해요",
      "바삭해요",
      "신선해요",
      "양념",
      "촉촉해요",
      "매콤해요",
      "잡내가 없어요",
      "깔끔해요",
    ],
    quantity_price: [
      "양 많아요",
      "합리적이에요",
      "구성이 알차요",
      "든든해요",
      "푸짐해요",
    ],
    packaging_delivery: [
      "포장이 깔끔해요",
      "빠른 배달",
      "따뜻해요",
      "사진과 같아요",
      "정성",
      "서비스",
      "친절",
    ],
    revisit_recommend: ["재주문 예정", "단골", "주변 추천"],
    context: [
      "해장",
      "혼밥",
      "가족",
      "친구",
      "아이",
      "어른들",
      "안주",
      "야식",
      "회식",
      "파티",
      "야근",
      "추운 날",
      "더운 날",
      "기분 전환",
    ],
  },
  negative: {
    taste: [
      "맛이 없어요",
      "짜요",
      "싱거워요",
      "느끼해요",
      "퍼졌어요",
      "비려요",
      "맛이 달라졌어요",
      "질겨요",
      "위생 문제",
      "이물질",
      "눅눅해요",
      "딱딱해요",
      "간이 안 맞아요",
      "덜 익었어요",
      "매워요",
      "상했어요",
      "두꺼워요",
      "얇아요",
      "퍽퍽해요",
      "탔어요",
      "끈적해요",
      "냄새가 안 좋아요",
    ],
    quantity_price: ["양이 적어요", "비싸요", "부실해요"],
    packaging_delivery: [
      "포장 불량",
      "배달 지연",
      "메뉴 누락",
      "오배송",
      "불친절",
      "식었어요",
      "녹았어요",
      "불었어요",
      "요청사항 누락",
      "사진과 달라요",
      "수저 누락",
      "리뷰이벤트 누락",
    ],
    revisit_recommend: [
      "재주문 안해요",
      "실망",
      "주변에 비추해요",
      "아쉬워요",
      "옵션 추가 요청",
    ],
    context: [],
  },
};

export const REVIEW_KEYWORD_ALLOWED_SET = (() => {
  const out = new Set<string>();
  for (const sent of ["positive", "negative"] as const) {
    for (const cat of Object.keys(REVIEW_KEYWORD_CANONICALS[sent]) as ReviewKeywordCategory[]) {
      for (const kw of REVIEW_KEYWORD_CANONICALS[sent][cat]) out.add(`${sent}::${kw}`);
    }
  }
  return out;
})();

export const REVIEW_KEYWORD_CANONICAL_TO_CATEGORY = (() => {
  const out = new Map<string, ReviewKeywordCategory>();
  for (const sent of ["positive", "negative"] as const) {
    for (const cat of Object.keys(REVIEW_KEYWORD_CANONICALS[sent]) as ReviewKeywordCategory[]) {
      for (const kw of REVIEW_KEYWORD_CANONICALS[sent][cat]) out.set(`${sent}::${kw}`, cat);
    }
  }
  return out;
})();

/**
 * UI/모델이 흔히 만드는 변형을 설계서 canonical로 강제 매핑.
 * (이건 alias 테이블로도 흡수되지만, 추출 단계에서 즉시 고정하기 위한 안전장치)
 */
export const REVIEW_KEYWORD_CANONICAL_COERCE: Record<
  ReviewKeywordSentiment,
  Record<string, string>
> = {
  positive: {
    "배달이 빨라요": "빠른 배달",
    "배달 빠름": "빠른 배달",
    "요청사항 반영": "서비스",
    "서비스 만족": "서비스",
    "친절한 서비스": "친절",
    "강력 추천": "주변 추천",
    "추천해요": "주변 추천",
    "단골 예약": "단골",
    "단골 맛집": "단골",
    "재주문 의사": "재주문 예정",
    "재주문": "재주문 예정",
    "재방문 의사": "재주문 예정",
    "맛있음": "맛있어요",
    "맛있습니다": "맛있어요",
    "맛이 좋음": "맛있어요",
    "맛이 훌륭함": "맛있어요",
    "뛰어난 맛": "맛있어요",
    "훌륭한 맛": "맛있어요",
    "최고의 맛": "맛있어요",
    "푸짐한 양": "양 많아요",
    "넉넉한 양": "양 많아요",
    "가성비 좋음": "합리적이에요",
    "깔끔한 포장": "포장이 깔끔해요",
  },
  negative: {
    "맛없음": "맛이 없어요",
    "싱거운 간": "싱거워요",
    "간이 싱거움": "싱거워요",
    "간이 강함": "간이 안 맞아요",
    "강한 간": "간이 안 맞아요",
    "간 조절 필요": "간이 안 맞아요",
    "포장 상태 불량": "포장 불량",
    "배달 상태 불량": "배달 지연",
    "수저 미동봉": "수저 누락",
    "요청사항 미이행": "요청사항 누락",
    "오배송 발생": "오배송",
    "구성품 누락": "메뉴 누락",
    "구성품 누락 확인": "메뉴 누락",
    "소스 양 부족": "부실해요",
  },
};

