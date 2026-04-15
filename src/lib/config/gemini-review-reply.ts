/**
 * 리뷰 답글 생성 (`ai-draft-service`, `POST /api/demo/review-reply`) 공통 Gemini 설정.
 */

import { ENV_KEY } from "@/lib/config/env-keys";

/** @see Google AI Studio / Gemini API model id */
export const GEMINI_REVIEW_REPLY_MODEL = "gemini-3-flash-preview" as const;

export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS = 2048;

/** 데모 라우트: MAX_TOKENS·잘림 의심 시 재시도용 상한 */
export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY = 3072;

/** 답변 토큰 확보를 위해 추론 토큰 최소화 (`thinkingConfig`) */
export const GEMINI_REVIEW_REPLY_THINKING_BUDGET = 0 as const;

export function getGeminiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env[ENV_KEY.GEMINI_API_KEY] ?? process.env[ENV_KEY.GOOGLE_API_KEY];
  const k = typeof raw === "string" ? raw.trim() : "";
  return k.length > 0 ? k : undefined;
}
