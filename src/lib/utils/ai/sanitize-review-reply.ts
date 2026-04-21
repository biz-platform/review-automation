export function sanitizeReviewReplyDraft(raw: string): string {
  let text = (raw ?? "").trim();
  if (!text) return "";

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
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => !badLineRe.test(l.trim()))
    .filter((l) => !/\(공백\s*포함\s*\d+\s*자\)/.test(l));
  text = lines.join("\n").trim();

  // 6) 과도한 연속 중복 완화(동일 라인 반복)
  text = text.replace(/(^.+$)(\n\1){1,}/gm, "$1");

  // 7) 과도한 연속 중복 완화(동일 문장 반복: 공백으로 이어붙은 케이스)
  text = collapseConsecutiveDuplicateSentences(text);

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
