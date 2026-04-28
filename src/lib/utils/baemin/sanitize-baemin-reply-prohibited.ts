/**
 * 배민 사장님 자사이트(self) 댓글 등록 시 클라이언트 검증으로 막히는 표현 제거·완화.
 * (예: 닉네임에 "요기요" 포함 → 본문에 그대로 쓰면 등록 불가)
 */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 줄 단위로 `닉네임님` 호칭만 `고객님,` 으로 치환 (닉네임에 금칙어가 있어도 인사는 통과) */
function replaceHonorificWithCustomerGreeting(
  text: string,
  customerNickname: string,
): string {
  const nick = customerNickname.trim();
  if (!nick) return text;
  const escaped = escapeRegExp(nick);
  const re = new RegExp(`^\\s*${escaped}\\s*님[,，]?\\s*`);
  return text
    .split("\n")
    .map((line) => line.replace(re, "고객님, "))
    .join("\n");
}

const BAEMIN_SELF_COMPETITOR_SUBSTR_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  // 배민 self 입력 제한(경쟁사/타 배달앱명). "쿠팡"은 "쿠팡이츠"를 포함하므로 더 구체적인 패턴을 먼저 둔다.
  { pattern: /쿠팡\s*이\s*츠/gi, replacement: "타배달앱" },
  { pattern: /쿠팡이츠/gi, replacement: "타배달앱" },
  { pattern: /쿠팡\s*잇\s*츠/gi, replacement: "타배달앱" }, // 흔한 오타
  { pattern: /쿠팡/gi, replacement: "타배달앱" },
  { pattern: /땡겨요/gi, replacement: "타배달앱" },
  { pattern: /요기요/gi, replacement: "타배달앱" },
];

/**
 * @param content 등록하려는 댓글 본문
 * @param customerNickname 리뷰 `author_name` 등 (없으면 호칭 치환만 스킵, 금칙어 서브스트링 치환은 수행)
 */
export function sanitizeBaeminReplyProhibitedTerms(
  content: string,
  customerNickname?: string | null,
): string {
  let out = content ?? "";
  if (customerNickname != null && String(customerNickname).trim() !== "") {
    out = replaceHonorificWithCustomerGreeting(out, String(customerNickname));
  }
  for (const { pattern, replacement } of BAEMIN_SELF_COMPETITOR_SUBSTR_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/[ \t]{2,}/g, " ").trim();
}

/** browser job payload에서 리뷰 작성자 닉네임 추출 (`author_name` / `authorName`) */
export function baeminCustomerNicknameFromReplyJobPayload(
  payload: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!payload) return undefined;
  const a = payload.author_name ?? payload.authorName;
  return typeof a === "string" && a.trim() ? a.trim() : undefined;
}
