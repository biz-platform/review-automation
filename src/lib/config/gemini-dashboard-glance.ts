/**
 * 대시보드 한눈 요약 인사이트 생성 공통 Gemini 설정.
 */

import { ENV_KEY } from "@/lib/config/env-keys";

/** @see Google AI Studio / Gemini API model id */
export const GEMINI_DASHBOARD_GLANCE_MODEL = "gemini-3-flash-preview" as const;

export const GEMINI_DASHBOARD_GLANCE_MAX_OUTPUT_TOKENS = 512;

/** 규칙 준수(2문장) 위해 추론 토큰 최소화 */
export const GEMINI_DASHBOARD_GLANCE_THINKING_BUDGET = 0 as const;

export function getGeminiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env[ENV_KEY.GEMINI_API_KEY] ?? process.env[ENV_KEY.GOOGLE_API_KEY];
  const k = typeof raw === "string" ? raw.trim() : "";
  return k.length > 0 ? k : undefined;
}
