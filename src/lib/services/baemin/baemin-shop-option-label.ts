/**
 * 배민 셀프서비스 리뷰 페이지 매장 select option 텍스트 파서.
 *
 * 레거시: "[음식배달] 허세김밥 / 김밥 14391201" → 이름·카테고리
 * 컴팩트(신규 UI): "양식 14790324 파슷타애요", "치킨 14583286 노랑통닭" → 업종·표시명 힌트
 */

/** "… / 김밥 14391201" → "김밥" (끝 숫자 shopNo 제거) */
function parseCategoryFromLegacySlashOptionText(text: string): string | null {
  const afterSlash = text.split(" / ")[1];
  if (!afterSlash) return null;
  const category = afterSlash.replace(/\s+\d+$/, "").trim();
  return category || null;
}

/**
 * 공백으로 구분된 `업종 shopNo(숫자) 브랜드…` 한 줄 포맷.
 * 예: "양식 14790324 파슷타애요" → 업종 "양식"
 * 배민 shopNo는 보통 5~8자리 — 4자리까지 허용(레거시·예외 대비)
 */
export function parseCategoryFromBaeminCompactShopOptionText(
  text: string,
): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)\s+(\d{4,12})\s+(.+)$/);
  if (!m) return null;
  const cat = m[1].trim();
  return cat || null;
}

/** 컴팩트 포맷에서 shopNo 뒤 표시(브랜드 등) */
export function parseShopNameFromBaeminCompactShopOptionText(
  text: string,
): string | null {
  const t = text.trim();
  if (!t) return null;
  const m = t.match(/^(.+?)\s+(\d{4,12})\s+(.+)$/);
  if (!m) return null;
  const name = m[3].trim();
  return name || null;
}

/**
 * DB·워커 저장용: 파싱 성공 시 업종만, 실패 시 원문(트림) 유지.
 * 이미 "양식"처럼 짧은 값은 파서가 null을 내도 원문을 그대로 쓴다.
 */
export function normalizeBaeminShopCategoryLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  return parseCategoryFromBaeminShopOptionText(t) ?? t;
}

/** 레거시 → 컴팩트 순으로 업종만 추출 */
export function parseCategoryFromBaeminShopOptionText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const legacy = parseCategoryFromLegacySlashOptionText(t);
  if (legacy != null) return legacy;
  return parseCategoryFromBaeminCompactShopOptionText(t);
}

/**
 * option 앞부분에서 표시 가게명 추출.
 * "[음식배달] 허세김밥 / …" → "허세김밥"
 * 컴팩트: "양식 14790324 파슷타애요" → "파슷타애요"
 */
export function parseShopNameFromBaeminShopOptionText(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  if (t.includes(" / ")) {
    const beforeSlash = t.split(" / ")[0]?.trim() ?? "";
    if (!beforeSlash) return null;
    const withoutServicePrefix = beforeSlash.replace(/^\[[^\]]+\]\s*/, "").trim();
    return withoutServicePrefix || null;
  }
  return parseShopNameFromBaeminCompactShopOptionText(t);
}
