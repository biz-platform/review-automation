import { stripGeminiThoughtLeakFromText } from "@/lib/utils/ai/extract-gemini-reply-visible-text";

/** 1~3점 답글: 모델이 ✨·별·반짝 이모지를 쓰는 것을 막기 위한 방어용(프롬프트가 1차) */
function stripSparkleStarEmojisForLowRating(text: string): string {
  return text
    .replace(/✨|⭐|🌟|💫/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export type SanitizeReviewReplyDraftOpts = {
  /** 1~5. 1~3이면 긍정형 스파클·별 이모지 제거 등 저평점 전용 후처리 */
  starRating?: number | null;
};

/** 연속으로 완전히 같은 문단(\n\n 구분) 제거 — 모델이 동일 블록을 수십 번 반복할 때 */
function collapseConsecutiveDuplicateParagraphs(input: string): string {
  const parts = input.split(/\n\n+/).map((p) => p.trim());
  const out: string[] = [];
  for (const p of parts) {
    if (!p) continue;
    if (out.length > 0 && out[out.length - 1] === p) continue;
    out.push(p);
  }
  return out.join("\n\n").trim();
}

/**
 * 연속으로 동일한 N줄 블록(각 줄 비어 있지 않음, 2≤N≤maxLines)이면 1회만 남김.
 * `\n\n` 없이 한 줄씩만 붙어 반복되는 붕괴용. 블록 안에 빈 줄이 끼면 비교하지 않음(오탐 방지).
 */
function collapseConsecutiveDuplicateLineBlocks(
  lines: string[],
  maxBlockLines: number,
): string[] {
  const norm = (chunk: string[]) => chunk.map((l) => l.trimEnd()).join("\n");
  const allNonEmpty = (chunk: string[]) =>
    chunk.length > 0 && chunk.every((l) => l.trim() !== "");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i]!.trim() === "") {
      out.push(lines[i]!);
      i += 1;
      continue;
    }
    let consumed = false;
    const maxB = Math.min(maxBlockLines, Math.floor((lines.length - i) / 2));
    for (let b = maxB; b >= 2; b--) {
      if (i + 2 * b > lines.length) continue;
      const a = lines.slice(i, i + b);
      const c = lines.slice(i + b, i + 2 * b);
      if (!allNonEmpty(a) || !allNonEmpty(c)) continue;
      if (norm(a) !== norm(c)) continue;
      let j = i + b;
      while (j + b <= lines.length) {
        const n = lines.slice(j, j + b);
        if (!allNonEmpty(n) || norm(n) !== norm(a)) break;
        j += b;
      }
      out.push(...a);
      i = j;
      consumed = true;
      break;
    }
    if (!consumed) {
      out.push(lines[i]!);
      i += 1;
    }
  }
  return out;
}

export function sanitizeReviewReplyDraft(
  raw: string,
  opts?: SanitizeReviewReplyDraftOpts,
): string {
  const DEBUG = process.env.DEBUG_REVIEW_REPLY_SANITIZE === "1";
  let text = (raw ?? "").trim();
  if (!text) return "";

  // 일부 경로(예: JSON payload)에서 개행이 "\\n" 리터럴로 들어오는 경우 복구
  text = text.replace(/\\n/g, "\n");
  text = stripGeminiThoughtLeakFromText(text);

  // 모델/프롬프트가 JSON으로 감싸서 주는 케이스: { "reply": "..." }
  text = unwrapJsonReplyIfAny(text);

  // 1) 코드펜스/마크다운 제거(가끔 ```로 감싸서 옴)
  text = text
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();

  // 2) CoT/내부 태그가 본문에 섞인 경우(모델·SDK에 따라 한 줄 또는 블록)
  text = text
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "")
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();

  // 3) 일부 모델 출력이 댓글 앞에 메타 prefix를 붙이는 케이스 제거
  text = text
    .replace(
      /^(?:thoughtful\b.*|thought\b.*|string length check:.*)\s*\n+/i,
      "",
    )
    .replace(
      /^(?:[^\S\r\n]*[)\]}»»—–-]{0,3}[^\S\r\n]*)确认铺垫.*\n+/i,
      "",
    );

  // 4) 출력 말미 자모 반복 붕괴(ㄴㄷㄴㄷ…) 제거
  text = text.replace(/(?:ㄴㄷ){10,}\s*$/g, "").trim();

  // 5) 모델이 규칙/분석/검수/카운트 등을 그대로 출력하는 라인 제거
  const badLineRe =
    /^(?:\[[^\]]+\]|리뷰\s*핵심\s*파악|리뷰\s*분석|작성\s*규칙|글자수\s*(?:계산|체크)|최종\s*(?:검토|확정|체크)|마지막\s*(?:체크|확인|점검)|OK\b|출력\s*형식|1단계|2단계|규칙:|지침:|주의:|^thought\b|_.*(?:최종|수정|확정|체크).*)/i;
  /** 루브릭·자기검수 문구가 본문에 섞인 경우(프롬프트의 글자수/문단/이모지 지시 유출) */
  const rubricLineRe =
    /이모지.*(?:문단|\d+\s*[-~]\s*\d+\s*자)|(?:문단|글자)\s*수.*\d+\s*[-~]\s*\d+|(?:\d+\s*[-~]\s*\d+\s*자\s*내외).*(?:답변|댓글)|(?:구성을\s*갖춘).*(?:답변|댓글)/i;
  /**
   * 단일 part + thinking 모델에서 글자 수 맞추기·초안 체크리스트가 본문 끝에 붙는 유형
   * 예: `✨ (2) = 75자 (공백 포함)`, `... 총합 245자 내외 확인`, `* "손님8님" 언급 1회`, `* 3~4문단`
   */
  const internalDraftingLineRe =
    /^\s*(?:✨\s*)?(?:\(\d+\)\s*=\s*)?\d+\s*자\s*\(공백\s*포함\)\s*$|^\s*(?:\.{2,}|…+)\s*총합\s*\d+\s*자[^\n]*\s*$|^\s*총합\s*\d+\s*자\s*내외\s*확인\.?\s*$|^\s*(?:[*•·-]+\s*)+["'][^"'\n]+["']\s*언급\s*\d+\s*회\.?\s*$|^\s*(?:[*•·-]+\s*)+\d+\s*[~～]\s*\d+\s*문단\.?\s*$|^\s*\(\d+\)\s*=\s*\d+\s*자\s*$/i;

  // “프롬프트/검수 메타가 답글 뒤에 붙는” 대표 패턴이면 그 지점부터 통째로 잘라낸다(라인 필터로는 누락되기 쉬움).
  // 예) "마지막 체크: [맛·만족 위주...]" / "닉네임 1회 자연스럽게"
  const cutAtRe =
    /(?:\n{1,2}|\A)\s*(?:마지막\s*(?:체크|확인|점검)\s*[:：]|최종\s*(?:체크|검토)\s*[:：]|참고\s*[:：]|\[맛·만족\s*위주|\[문장\s*길이\]|\[출력\s*주의\]|투머치|금지\(|지침\s*위반|위반\s*없음|하나\s*더\s*체크)/i;
  const cutIdx = text.search(cutAtRe);
  if (cutIdx > 0) {
    if (DEBUG) {
      console.warn("[sanitize-review-reply] cutAtRe matched", {
        rawLen: raw?.length ?? 0,
        beforeCutLen: text.length,
        cutIdx,
        cutHead: text.slice(Math.max(0, cutIdx - 20), cutIdx + 40),
      });
    }
    text = text.slice(0, cutIdx).trim();
  }
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => !badLineRe.test(l.trim()))
    .filter((l) => !rubricLineRe.test(l.trim()))
    .filter((l) => !internalDraftingLineRe.test(l.trim()))
    // "닉네임 1회" 같은 메타 지시문이 그대로 노출되는 케이스 제거
    .filter((l) => !/닉네임\s*\d+\s*회/.test(l))
    .filter((l) => !/자연스럽게\)\s*\*/.test(l))
    .filter((l) => !/\(공백\s*포함\s*\d+\s*자\)/.test(l));
  const lineBlocked = collapseConsecutiveDuplicateLineBlocks(lines, 14);
  text = lineBlocked.join("\n").trim();

  // 5b) 문단 단위 연속 중복(빈 줄로 구분된 동일 블록 반복)
  text = collapseConsecutiveDuplicateParagraphs(text);

  // 6) 과도한 연속 중복 완화(동일 라인 반복)
  text = text.replace(/(^.+$)(\n\1){1,}/gm, "$1");

  // 7) 과도한 연속 중복 완화(동일 문장 반복: 공백으로 이어붙은 케이스)
  // NOTE: 문단/줄바꿈이 이미 있는 초안은 그대로 보존해야 함(줄바꿈이 UX 요구사항인 경우가 많음).
  // 단일 라인으로 이어 붙은 반복만 정리한다.
  if (!text.includes("\n")) {
    text = collapseConsecutiveDuplicateSentences(text);
    // 줄바꿈이 전혀 없는 경우, 문장 구분이 가능한 텍스트는 문장 단위로 줄바꿈을 강제한다.
    // (구두점이 없으면 건드리지 않음)
    text = enforceSentenceLineBreaks(text);
  }

  // 7b) 토큰 경계 깨짐(…💕해요 → …💕ㄴ요.) 보정
  text = text.replace(/💕ㄴ요\.\s*✨/g, "💕✨");

  // 8) 공백 정리
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  // 9) 이모지 단독 줄은 바로 위 문장 끝에 붙임 (줄바꿈 유지하면서 이모지만 별도 줄로 뜨는 UX 방지)
  text = attachEmojiOnlyLinesToPreviousText(text).trim();

  // 10) 문단 구분이 전혀 없는 케이스 보정: 최소 1회는 "\n\n"로 문단을 나눔
  text = ensureAtLeastOneParagraphBreak(text).trim();

  const r = opts?.starRating;
  if (typeof r === "number" && r >= 1 && r <= 3) {
    text = stripSparkleStarEmojisForLowRating(text);
  }
  return text;
}

function collapseConsecutiveDuplicateSentences(input: string): string {
  const raw = input.trim();
  if (!raw) return "";

  // 문장 구분: 종결부호(.,!,?,。,！,？) 기준 + 공백
  const parts = raw.split(/(?<=[.!?。！？])\s+/g);
  if (parts.length <= 1) return raw;

  const out: string[] = [];
  for (const p of parts) {
    const cur = p.trim();
    if (!cur) continue;
    const prev = out[out.length - 1]?.trim() ?? "";
    if (prev && normalizeSentence(prev) === normalizeSentence(cur)) continue;
    out.push(cur);
  }
  return out.join(" ").trim();
}

function enforceSentenceLineBreaks(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  if (raw.includes("\n")) return raw;

  // 문장 구분이 되는 경우만 줄바꿈 적용 (2문장 이상)
  const parts = raw.split(/(?<=[.!?。！？])\s+/g).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return raw;
  return parts.join("\n").trim();
}

function ensureAtLeastOneParagraphBreak(input: string): string {
  const raw = input.replace(/\r\n/g, "\n").trim();
  if (!raw) return "";
  if (raw.includes("\n\n")) return raw;

  // 라인이 여러 개인데 문단(빈 줄) 구분이 없으면, 첫 줄 끝에 1회만 문단 구분을 만든다.
  // (모든 줄을 문단으로 만들면 과해져서 최소만 보장)
  const lines = raw.split("\n");
  const nonEmpty = lines.filter((l) => l.trim() !== "");
  if (nonEmpty.length < 3) return raw;

  for (let i = 0; i < lines.length - 1; i += 1) {
    const a = lines[i] ?? "";
    const b = lines[i + 1] ?? "";
    if (a.trim() !== "" && b.trim() !== "") {
      lines[i] = a.replace(/\s+$/g, "");
      lines[i + 1] = b.replace(/^\s+/g, "");
      return [...lines.slice(0, i + 1), "", ...lines.slice(i + 1)].join("\n").trim();
    }
  }
  return raw;
}

function isEmojiOnlyLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // "👍", "🙏😊", "👍👍", "👍 !" 같은 라인만 대상으로 (텍스트가 섞이면 false)
  // ASCII 문자(알파벳/숫자)나 한글/한자 등이 있으면 제외.
  if (/[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ一-龥]/.test(t)) return false;

  // 이모지 + 구두점/공백만 허용
  // Extended_Pictographic는 대부분의 이모지를 커버.
  const stripped = t
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\s\uFE0F\u200D.,!?~"“”'’(){}\[\]<>:;·•\-_/\\]+/gu, "");
  return stripped.length === 0;
}

function attachEmojiOnlyLinesToPreviousText(input: string): string {
  const raw = input.replace(/\r\n/g, "\n");
  const lines = raw.split("\n");
  const out: string[] = [];

  for (const line of lines) {
    if (out.length > 0 && isEmojiOnlyLine(line)) {
      const emoji = line.trim();
      const prev = out[out.length - 1] ?? "";
      out[out.length - 1] = `${prev.replace(/\s+$/g, "")} ${emoji}`.trimEnd();
      continue;
    }
    out.push(line);
  }

  return out.join("\n");
}

function unwrapJsonReplyIfAny(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (!t.startsWith("{") || !t.includes('"reply"')) return t;

  // 1) 완전한 JSON이면 파싱해서 reply만 꺼냄
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object" && "reply" in parsed) {
      const v = (parsed as { reply?: unknown }).reply;
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  } catch {
    // ignore
  }

  // 2) 잘린/불완전 JSON이면 "reply": "<여기부터>" 만 뽑아서 복구
  const m = /"reply"\s*:\s*"([\s\S]*)$/m.exec(t);
  if (!m) return t;
  let s = m[1] ?? "";
  // 뒤에 다른 필드/중괄호가 붙어온 경우 대충 잘라내기
  s = s.replace(/"\s*[,}][\s\S]*$/m, "");
  // escape 복구
  s = s.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  return s.trim() || t;
}

function normalizeSentence(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/[.。]+$/g, ".")
    .trim()
    .toLowerCase();
}
