import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY,
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY_2,
  GEMINI_REVIEW_REPLY_MODEL,
  GEMINI_REVIEW_REPLY_THINKING_CONFIG,
} from "@/lib/config/gemini-review-reply";
import {
  extractGeminiReplyVisibleText,
  type GeminiContentPart,
} from "@/lib/utils/ai/extract-gemini-reply-visible-text";
import { sanitizeReviewReplyDraft } from "@/lib/utils/ai/sanitize-review-reply";

type GenerateContentResponse = {
  text?: string;
  candidates?: Array<{
    content?: { parts?: GeminiContentPart[] };
    finishReason?: string;
  }>;
};

function readFinishReason(res: unknown): string | undefined {
  return (res as GenerateContentResponse).candidates?.[0]?.finishReason;
}

/**
 * Gemini가 MAX_TOKENS 등으로 끊었을 때 마지막 문장이 덜렁 끝나는지 판별.
 * 마침표 없는 한국어 완결(해요/습니다 등)은 완료로 본다.
 */
export function isLikelyTruncatedReviewReply(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) return true;

  let core = trimmed
    .replace(/[\s\uFE0F\u200D\p{Extended_Pictographic}]+$/gu, "")
    .trim();
  if (!core) return true;

  core = core.replace(/\^+\s*$/g, "").trim();
  if (!core) return false;

  if (/[.!?。！？]["'」』)\]]*\s*$/.test(core)) return false;

  const completeHangulEnding =
    /(?:습니다|습니까|합니다|입니다|해요|이에요|예요|어요|네요|군요|죠|까요|세요|주세요|게요|할게요|드릴게요|드려요|드립니다|바랍니다|겠습니다|있어요|없어요|감사합니다|죄송합니다|부탁드립니다|알겠습니다|뵙겠습니다|찾아주세요|고맙습니다|말씀드립니다|사과드립니다|감사드립니다|점검하겠습니다|보완하겠습니다|노력하겠습니다|살펴보겠습니다|준비하겠습니다|기다리겠습니다|참고하겠습니다|보답하겠습니다|개선하겠습니다|궁금했는데요|쓰이네요|있습니다|없습니다|보여드릴게요|살펴볼게요)$/u;
  if (completeHangulEnding.test(core)) return false;

  if (/(?:별점까|될\s*것|도움이\s*될\s*것|보완해|걱정이)$/u.test(core)) return true;

  // MAX_TOKENS/후처리 절단 꼬리 (종결 없이 조사·어미만 남은 경우)
  if (/기를$/u.test(core) && !/(?:이야기를|얘기를|말씀을)\s*$/u.test(core)) return true;
  if (/하겠$/u.test(core) && !/하겠습니다$/u.test(core)) return true;
  if (/하도록\s*하겠$/u.test(core)) return true;

  const openParen = (trimmed.match(/\(/g) ?? []).length;
  const closeParen = (trimmed.match(/\)/g) ?? []).length;
  if (openParen !== closeParen) return true;

  return true;
}

const COMPLETION_HINT = `

[출력 주의]
반드시 마지막 문장을 종결어미(예: ~습니다, ~해요, ~드립니다)나 마침표로 끝내세요. 중간에서 끊기면 안 됩니다.`;

/**
 * 리뷰 답글용 generateContent: 출력 상한을 넉넉히 두고, 잘림·MAX_TOKENS 시 최대 2회 재시도.
 */
export async function generateGeminiReviewReplyText(args: {
  ai: GoogleGenAI;
  userPrompt: string;
  systemPrompt: string;
}): Promise<{
  text: string;
  finishReason?: string;
  lastResponse: unknown;
}> {
  const { ai, userPrompt, systemPrompt } = args;
  const DEBUG = process.env.DEBUG_REVIEW_REPLY_GEMINI === "1";

  const replyJsonSchema = {
    type: "object",
    properties: {
      reply: { type: "string", description: "고객에게 보이는 최종 댓글 평문" },
    },
    required: ["reply"],
    additionalProperties: false,
  } as const;

  const parseStructuredReply = (raw: string): string => {
    const t = (raw ?? "").trim();
    if (!t) return "";
    try {
      const obj = JSON.parse(t) as { reply?: unknown };
      return typeof obj.reply === "string" ? obj.reply.trim() : "";
    } catch {
      return "";
    }
  };

  const runOnce = async (contents: string, maxOutputTokens: number) => {
    const res = await ai.models.generateContent({
      model: GEMINI_REVIEW_REPLY_MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens,
        responseMimeType: "application/json",
        responseJsonSchema: replyJsonSchema,
        thinkingConfig: { ...GEMINI_REVIEW_REPLY_THINKING_CONFIG },
      },
    });
    // Structured output에서는 response.text(JSON)가 핵심.
    // extractor(가시 텍스트 병합/누설 제거)가 JSON을 망가뜨리거나 일부 part만 취해
    // "중간에서 잘린 것처럼" 만들 수 있어 raw text를 우선한다.
    const rawText = ((res as GenerateContentResponse).text ?? "").trim();
    const extracted = extractGeminiReplyVisibleText(res);
    if (DEBUG) {
      console.warn("[review-reply-gemini-run] raw response stats", {
        model: GEMINI_REVIEW_REPLY_MODEL,
        finishReason: readFinishReason(res),
        maxOutputTokens,
        getterTextLen: rawText.length,
        extractedLen: extracted.combined.length,
        extractedFromGetterLen: extracted.fromGetterLen,
        extractedFromPartsLen: extracted.fromPartsLen,
        partsCount: extracted.partsCount,
      });
    }
    return {
      text: rawText || extracted.combined,
      finishReason: readFinishReason(res),
      lastResponse: res,
    };
  };

  const runAndCoerce = async (contents: string, maxOutputTokens: number) => {
    const out = await runOnce(contents, maxOutputTokens);
    const structured = parseStructuredReply(out.text);
    const parsedOk = structured.trim().length > 0;
    // structured 파싱 성공 시 JSON 필드만 sanitize. 실패 시(구조화 출력 불이행 등) raw를 sanitize.
    const sanitized = sanitizeReviewReplyDraft(structured || out.text);
    if (DEBUG) {
      console.warn("[review-reply-gemini-run] coerce stats", {
        parsedOk,
        rawLen: out.text.length,
        structuredLen: structured.length,
        sanitizedLen: sanitized.length,
        sanitizedLikelyTruncated: isLikelyTruncatedReviewReply(sanitized),
        sanitizedEndSnippet: sanitized.slice(Math.max(0, sanitized.length - 80)),
      });
    }
    return { ...out, text: sanitized };
  };

  let { text, finishReason, lastResponse } = await runAndCoerce(
    userPrompt,
    GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
  );

  const needRetry = (r: string | undefined) =>
    r === "MAX_TOKENS" || isLikelyTruncatedReviewReply(text);

  if (needRetry(finishReason)) {
    ({ text, finishReason, lastResponse } = await runAndCoerce(
      `${userPrompt}${COMPLETION_HINT}`,
      GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY,
    ));
  }

  if (needRetry(finishReason)) {
    ({ text, finishReason, lastResponse } = await runAndCoerce(
      `${userPrompt}${COMPLETION_HINT}\n한 문단 더 짧게 써도 좋으니, 반드시 완결된 한 덩어리로 끝내세요.`,
      GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY_2,
    ));
  }

  // 최종 출력이 여전히 “문장 중간 잘림”이면, 완전 짧게(2문장 이하) 재작성하도록 한 번 더 강하게 유도.
  if (needRetry(finishReason)) {
    ({ text, finishReason, lastResponse } = await runAndCoerce(
      `${userPrompt}${COMPLETION_HINT}\n이전 출력이 중간에서 끊겼습니다. 처음부터 다시 1~2문장으로만, 반드시 종결어미로 끝내세요.`,
      Math.min(2048, GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY_2),
    ));
  }

  return { text, finishReason, lastResponse };
}
