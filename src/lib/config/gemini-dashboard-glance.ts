/**
 * 대시보드 한눈 요약 인사이트 생성 공통 Gemini 설정.
 */

import { ENV_KEY } from "@/lib/config/env-keys";

/** @see Google AI Studio / Gemini API model id */
export const GEMINI_DASHBOARD_GLANCE_MODEL = "gemini-3-flash-preview" as const;

export const GEMINI_DASHBOARD_GLANCE_MAX_OUTPUT_TOKENS = 512;

/**
 * `gemini-3-flash-preview` 는 thinking 전용 — 0 이면 400. `-1` = 자동 예산.
 * @see `gemini-review-reply.ts` 동일 이슈
 */
export const GEMINI_DASHBOARD_GLANCE_THINKING_BUDGET = -1 as const;

export function getGeminiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env[ENV_KEY.GEMINI_API_KEY] ?? process.env[ENV_KEY.GOOGLE_API_KEY];
  const k = typeof raw === "string" ? raw.trim() : "";
  return k.length > 0 ? k : undefined;
}
