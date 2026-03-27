/**
 * 배민 셀프서비스 리뷰 페이지 매장 select option 텍스트 파서.
 * 예: "[음식배달] 허세김밥 / 김밥 14391201" → 이름·카테고리
 */

/** "… / 김밥 14391201" → "김밥" (끝 숫자 절번 제거) */
export function parseCategoryFromBaeminShopOptionText(text: string): string | null {
  const afterSlash = text.split(" / ")[1];
  if (!afterSlash) return null;
  const category = afterSlash.replace(/\s+\d+$/, "").trim();
  return category || null;
}

/**
 * option 앞부분에서 표시 가게명 추출.
 * "[음식배달] 허세김밥 / …" → "허세김밥"
 */
export function parseShopNameFromBaeminShopOptionText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const beforeSlash = t.split(" / ")[0]?.trim() ?? "";
  if (!beforeSlash) return null;
  const withoutServicePrefix = beforeSlash.replace(/^\[[^\]]+\]\s*/, "").trim();
  return withoutServicePrefix || null;
}
