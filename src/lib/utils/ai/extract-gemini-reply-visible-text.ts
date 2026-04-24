/**
 * Gemini thinking 계열 모델: candidates[].content.parts 에 추론 요약이 별도 part로 올 수 있음.
 * `thought: true` 인 파트는 사용자 노출용 답변이 아니므로 제외한다.
 * @see https://ai.google.dev/gemini-api/docs/thinking
 */
export type GeminiContentPart = {
  text?: string;
  /** true 이면 모델 내부 추론(요약) — 답글 본문에 합치면 안 됨 */
  thought?: boolean;
};

const THOUGHT_LEAK_RE =
  /Customer Nickname|Star Rating|thoughtful\s*\*|^\s*thoughtful\b/i;

export function joinGeminiVisibleParts(
  parts: GeminiContentPart[] | undefined,
): string {
  if (!parts?.length) return "";
  const visible = parts.filter((p) => p.thought !== true);
  const toJoin = visible.length > 0 ? visible : parts;
  /**
   * 과거엔 thought/meta 누설 패턴이 보이면 "마지막 part만" 반환했는데,
   * 실제로는 답변이 여러 part로 나뉘는 경우가 있어 마지막 part만 취하면
   * 정상 답변의 앞부분이 통째로 날아가 “중간에서 잘린 답변”처럼 보일 수 있다.
   *
   * 따라서 여기서는 항상 전체를 join하고, meta 제거는 strip 단계에서 처리한다.
   */
  return toJoin.map((p) => p.text ?? "").join("").trim();
}

/**
 * thought 플래그 없이 한 덩어리로 오는 EN 메타·추론 조각 제거(보수적으로만 자름).
 * — sanitize 단계 전에 호출해도 됨.
 */
export function stripGeminiThoughtLeakFromText(s: string): string {
  const t = (s ?? "").trim();
  if (!t || !THOUGHT_LEAK_RE.test(t)) return t;

  if (/\r?\n/.test(t)) {
    const lines = t.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
      const L = lines[i]!.trimEnd();
      if (L.trim() === "") {
        i += 1;
        continue;
      }
      const hangulCount = (L.match(/[가-힣]/g) ?? []).length;
      const looksLikeMetaLine =
        /Customer Nickname|Star Rating|thoughtful|\*\s*Menu:|^Menu:/i.test(
          L,
        ) && hangulCount < 14;
      const asciiInstruction =
        /^[\x00-\x7F\s*•·,:()[\]{}\d-]{10,}$/.test(L) &&
        hangulCount === 0 &&
        /Customer|Menu|Star|thoughtful|Nickname/i.test(L);
      if (looksLikeMetaLine || asciiInstruction) {
        i += 1;
        continue;
      }
      break;
    }
    const sliced = lines.slice(i).join("\n").trim();
    if (sliced.length >= 12) return sliced;
    return t;
  }

  const segs = t.split(/\s*\*\s+/).map((x) => x.trim());
  if (segs.length >= 2) {
    for (let j = segs.length - 1; j >= 0; j--) {
      let seg = segs[j]!.trim();
      seg = seg.replace(/^(?:Star\s+Ra(?:ting)?|Ra(?:ting)?)\b\s*/i, "").trim();
      const hc = (seg.match(/[가-힣]/g) ?? []).length;
      if (hc < 14) continue;
      if (/^(Customer|Menu:|Star|thoughtful)/i.test(seg)) continue;
      if (/Customer Nickname|Star Rating/i.test(seg)) continue;
      return seg;
    }
  }

  const idx = t.search(/[가-힣]{10,}/);
  if (idx >= 28 && THOUGHT_LEAK_RE.test(t.slice(0, idx))) {
    const rest = t.slice(idx).trim();
    if (rest.length >= 24) return rest;
  }

  return t;
}

type GeminiGenerateContentShape = {
  text?: string;
  candidates?: Array<{
    content?: { parts?: GeminiContentPart[] };
    finishReason?: string;
  }>;
};

/** 데모·ai-draft 공통: `.text`만 쓰면 빈 문자열인 경우가 있어 parts 우선(추론 파트 제외) */
export function extractGeminiReplyVisibleText(response: unknown): {
  combined: string;
  fromGetterLen: number;
  fromPartsLen: number;
  finishReason?: string;
  partsCount: number;
} {
  const res = response as GeminiGenerateContentShape;
  const textFromGetter = (res.text ?? "").trim();
  const parts = res.candidates?.[0]?.content?.parts;
  const textFromParts = joinGeminiVisibleParts(parts);
  let combined =
    textFromParts.length > 0 ? textFromParts : textFromGetter;
  combined = stripGeminiThoughtLeakFromText(combined);
  return {
    combined,
    fromGetterLen: textFromGetter.length,
    fromPartsLen: textFromParts.length,
    finishReason: res.candidates?.[0]?.finishReason,
    partsCount: parts?.length ?? 0,
  };
}
