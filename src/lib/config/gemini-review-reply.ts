/**
 * 리뷰 답글 생성 (`ai-draft-service`, `POST /api/demo/review-reply`) 공통 Gemini 설정.
 */

import { ENV_KEY } from "@/lib/config/env-keys";

/** @see Google AI Studio / Gemini API model id */
export const GEMINI_REVIEW_REPLY_MODEL = "gemini-3-flash-preview" as const;

export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS = 2048;

/** 데모 라우트: MAX_TOKENS·잘림 의심 시 재시도용 상한 */
export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY = 3072;

/**
 * `thinkingBudget: 0` 은 추론 비활성화. `gemini-3-flash-preview` 는 thinking 전용이라
 * 400: "Budget 0 is invalid. This model only works in thinking mode."
 * SDK 스펙: `-1` = 자동 예산.
 */
export const GEMINI_REVIEW_REPLY_THINKING_BUDGET = -1 as const;

export function getGeminiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env[ENV_KEY.GEMINI_API_KEY] ?? process.env[ENV_KEY.GOOGLE_API_KEY];
  const k = typeof raw === "string" ? raw.trim() : "";
  return k.length > 0 ? k : undefined;
}
