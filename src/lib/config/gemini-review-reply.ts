/**
 * 리뷰 답글 생성 (`ai-draft-service`, `POST /api/demo/review-reply`) 공통 Gemini 설정.
 */

import { ENV_KEY } from "@/lib/config/env-keys";

/** @see Google AI Studio / Gemini API model id */
export const GEMINI_REVIEW_REPLY_MODEL =
  "gemini-3.1-flash-lite-preview" as const;

/** 답글 본문 + thinking이 같은 상한을 쓰므로 넉넉히(잘림 방지) */
export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS = 8192;

/** 1차 재시도 */
export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY = 8192;

/** 2차 재시도(짧게 쓰라고 유도했을 때 동일 한도) */
export const GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY_2 = 8192;

/** 키워드 추출 등 짧은 JSON/텍스트 전용 — 답글과 동일 상한 쓰면 낭비 */
export const GEMINI_REVIEW_REPLY_KEYWORD_MAX_OUTPUT_TOKENS = 2048;

/**
 * `thinkingBudget: 0` 은 추론 비활성화. `gemini-3.1-flash-lite-preview` 는 thinking 전용이라
 * 400: "Budget 0 is invalid. This model only works in thinking mode."
 * SDK 스펙: `-1` = 자동 예산.
 */
export const GEMINI_REVIEW_REPLY_THINKING_BUDGET = -1 as const;

/**
 * 내부 추론 강도는 `thinkingBudget`이 담당한다(-1 = 동적).
 * `includeThoughts`는 “응답 parts에 추론 요약 텍스트를 넣을지”와 가깝고, 끈다고 해서 추론 자체가 꺼지는 것은 아니지만
 * 오해·SDK 차이를 피하려 여기서는 넣지 않는다. thought part 누설은 `extractGeminiReplyVisibleText` 등에서 제거.
 */
export const GEMINI_REVIEW_REPLY_THINKING_CONFIG = {
  thinkingBudget: GEMINI_REVIEW_REPLY_THINKING_BUDGET,
  /**
   * thinking 계열 모델은 "thoughts"를 별도 part로 포함시킬 수 있는데,
   * 이 프로젝트는 최종 답글 본문만 필요하므로 항상 제외한다.
   * (includeThoughts 기본값이 SDK/모델에 따라 달라져, 어느 날 갑자기 프롬프트/자가검수 문구가 섞여 나오는 근본 원인이 됨)
   */
  includeThoughts: false,
} as const;

export function getGeminiApiKeyFromEnv(): string | undefined {
  const raw =
    process.env[ENV_KEY.GEMINI_API_KEY] ?? process.env[ENV_KEY.GOOGLE_API_KEY];
  const k = typeof raw === "string" ? raw.trim() : "";
  return k.length > 0 ? k : undefined;
}
