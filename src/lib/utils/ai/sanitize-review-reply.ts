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

export function sanitizeReviewReplyDraft(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

  // 일부 경로(예: JSON payload)에서 개행이 "\\n" 리터럴로 들어오는 경우 복구
  text = text.replace(/\\n/g, "\n");

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
    /^(?:\[[^\]]+\]|리뷰\s*핵심\s*파악|리뷰\s*분석|작성\s*규칙|글자수\s*(?:계산|체크)|최종\s*(?:검토|확정)|OK\b|출력\s*형식|1단계|2단계|규칙:|지침:|주의:|^thought\b|_.*(?:최종|수정|확정|체크).*)/i;
  /** 루브릭·자기검수 문구가 본문에 섞인 경우(프롬프트의 글자수/문단/이모지 지시 유출) */
  const rubricLineRe =
    /이모지.*(?:문단|\d+\s*[-~]\s*\d+\s*자)|(?:문단|글자)\s*수.*\d+\s*[-~]\s*\d+|(?:\d+\s*[-~]\s*\d+\s*자\s*내외).*(?:답변|댓글)|(?:구성을\s*갖춘).*(?:답변|댓글)/i;
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => !badLineRe.test(l.trim()))
    .filter((l) => !rubricLineRe.test(l.trim()))
    .filter((l) => !/\(공백\s*포함\s*\d+\s*자\)/.test(l));
  const lineBlocked = collapseConsecutiveDuplicateLineBlocks(lines, 14);
  text = lineBlocked.join("\n").trim();

  // 5b) 문단 단위 연속 중복(빈 줄로 구분된 동일 블록 반복)
  text = collapseConsecutiveDuplicateParagraphs(text);

  // 6) 과도한 연속 중복 완화(동일 라인 반복)
  text = text.replace(/(^.+$)(\n\1){1,}/gm, "$1");

  // 7) 과도한 연속 중복 완화(동일 문장 반복: 공백으로 이어붙은 케이스)
  text = collapseConsecutiveDuplicateSentences(text);

  // 7b) 토큰 경계 깨짐(…💕해요 → …💕ㄴ요.) 보정
  text = text.replace(/💕ㄴ요\.\s*✨/g, "💕✨");

  // 8) 공백 정리
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

function normalizeSentence(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, "")
    .replace(/[.。]+$/g, ".")
    .trim()
    .toLowerCase();
}
