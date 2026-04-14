import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildReviewReplySystemPrompt,
  buildReviewReplyUserPrompt,
  classifyReviewBodyMode,
  normalizeToneToKey,
  type ToneKey,
} from "@/lib/prompts/review-reply-prompts";
import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY,
  GEMINI_REVIEW_REPLY_MODEL,
  GEMINI_REVIEW_REPLY_THINKING_BUDGET,
  getGeminiApiKeyFromEnv,
} from "@/lib/config/gemini-review-reply";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { AppBadRequestError, AppError } from "@/lib/errors/app-error";

const CAFE_CONTEXT_RE =
  /라떼|아메리카노|에스프레소|커피|음료|카페|브루|latte|coffee|espresso|cappuccino|beverage|barista|brew/i;

const bodySchema = z.object({
  storeName: z.string().max(100).optional(),
  /** 체험·실서비스 공통: 내부 참고 업종 (예: 카페, 한식) */
  industry: z.string().max(80).optional(),
  rating: z.number().int().min(1).max(5),
  nickname: z.string().max(50).optional(),
  menu: z.string().max(200).optional(),
  reviewText: z.string().min(1, "리뷰 내용을 입력해주세요").max(2000),
  tone: z
    .enum(["default", "female_2030", "male_2030", "senior_4050"])
    .optional(),
  commentLength: z.enum(["short", "normal", "long"]).optional(),
});

function resolveDemoIndustryField(
  industry: string | undefined,
  storeName: string | undefined,
  reviewText: string,
  menu: string | undefined,
): string {
  const ind = industry?.trim();
  const store = storeName?.trim();
  const parts = [ind, store && store !== ind ? store : undefined].filter(
    Boolean,
  ) as string[];
  let 업종 = parts.join(" · ").slice(0, 80);
  const reviewMenu = `${reviewText}\n${menu ?? ""}`;
  const looksLikeCafe = CAFE_CONTEXT_RE.test(reviewMenu);
  const storeSaysCafe = store ? /카페|cafe|coffee/i.test(store) : false;
  if (!ind && looksLikeCafe && !storeSaysCafe) {
    업종 = [업종 || undefined, "카페·음료(리뷰 맥락)"]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 80);
  }
  return 업종 || "(체험)";
}

const LENGTH_RANGE: Record<
  "short" | "normal" | "long",
  { min: number; max: number }
> = {
  short: { min: 60, max: 100 },
  normal: { min: 140, max: 180 },
  long: { min: 220, max: 250 },
};

function isLikelyTruncatedReply(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed) return true;
  // 한국어/영문 문장 종료 구두점이 없으면 잘림 가능성이 높음
  if (!/[.!?。！？]$/.test(trimmed)) return true;
  // 마크다운/괄호 등이 열리고 닫히지 않은 경우
  const openParen = (trimmed.match(/\(/g) ?? []).length;
  const closeParen = (trimmed.match(/\)/g) ?? []).length;
  if (openParen !== closeParen) return true;
  return false;
}

function enforceMaxLengthBySentence(reply: string, max: number): string {
  const trimmed = reply.trim();
  if (trimmed.length <= max) return trimmed;
  const sliced = trimmed.slice(0, max);
  const lastSentenceEnd = Math.max(
    sliced.lastIndexOf("."),
    sliced.lastIndexOf("!"),
    sliced.lastIndexOf("?"),
    sliced.lastIndexOf("。"),
    sliced.lastIndexOf("！"),
    sliced.lastIndexOf("？"),
  );
  if (lastSentenceEnd >= Math.floor(max * 0.7)) {
    return sliced.slice(0, lastSentenceEnd + 1).trim();
  }
  return sliced.trim();
}

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<{ reply: string }>>> {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppBadRequestError({
      code: "VALIDATION_ERROR",
      message: "요청 형식이 올바르지 않습니다",
      detail: parsed.error.message,
    });
  }
  const {
    storeName,
    industry,
    rating,
    nickname,
    menu,
    reviewText,
    tone,
    commentLength,
  } = parsed.data;

  const toneKey: ToneKey = tone ? normalizeToneToKey(tone) : "default";
  const params = {
    업종: resolveDemoIndustryField(industry, storeName, reviewText, menu),
    주요_고객층: "(미설정)",
    닉네임: (nickname?.trim() || "고객").slice(0, 30),
    메뉴: (menu?.trim() || "(없음)").slice(0, 200),
    별점: `${rating}점`,
    리뷰_내용: reviewText.trim().slice(0, 2000),
  };

  const lengthKey = commentLength ?? "normal";
  const systemPrompt = buildReviewReplySystemPrompt(toneKey, lengthKey, params);
  const userPrompt = `${buildReviewReplyUserPrompt(params.리뷰_내용, lengthKey)}

[리뷰]
${params.리뷰_내용}`;

  const apiKey = getGeminiApiKeyFromEnv();
  if (!apiKey) {
    const fallback =
      classifyReviewBodyMode(params.리뷰_내용) === "none"
        ? `${params.닉네임}님, 소중한 평가 남겨주셔서 감사합니다. 앞으로도 변함없이 준비하겠습니다.`
        : `${params.닉네임}님, 리뷰 남겨주셔서 감사합니다. 다음에도 편하게 찾아주세요.`;
    return NextResponse.json<AppRouteHandlerResponse<{ reply: string }>>({
      result: { reply: fallback },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const genConfig = {
      model: GEMINI_REVIEW_REPLY_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: GEMINI_REVIEW_REPLY_THINKING_BUDGET },
      },
    };

    let reply = "";
    let debugInfo: Record<string, unknown> = { path: "unknown" };

    // 스트리밍은 조기 종료 케이스가 있어 non-stream 사용
    let res = await ai.models.generateContent(genConfig);
    const resAny = res as {
      text?: string;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
        tokenCount?: number;
      }>;
      usageMetadata?: {
        totalTokenCount?: number;
        candidatesTokenCount?: number;
        totalOutputTokenCount?: number;
      };
    };

    const textFromGetter = (res.text ?? "").trim();
    const textFromParts =
      resAny.candidates?.[0]?.content?.parts
        ?.map((p) => p.text ?? "")
        .join("")
        .trim() ?? "";

    // .text가 잘렸을 수 있으므로 parts 합친 게 더 길면 그걸 사용
    reply =
      textFromParts.length >= textFromGetter.length
        ? textFromParts
        : textFromGetter;

    // 잘림 의심 시(max tokens, 미완성 문장) 1회 재시도
    const finishReason = resAny.candidates?.[0]?.finishReason;
    if (finishReason === "MAX_TOKENS" || isLikelyTruncatedReply(reply)) {
      const retryUserPrompt = `${userPrompt}

반드시 문장이 완결되게 끝내고, 중간에 끊기지 않게 작성하세요.`;
      res = await ai.models.generateContent({
        ...genConfig,
        contents: retryUserPrompt,
        config: {
          ...genConfig.config,
          maxOutputTokens: GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS_RETRY,
        },
      });
      const retryAny = res as {
        text?: string;
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
          finishReason?: string;
          tokenCount?: number;
        }>;
      };
      const retryTextFromGetter = (retryAny.text ?? "").trim();
      const retryTextFromParts =
        retryAny.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? "")
          .join("")
          .trim() ?? "";
      reply =
        retryTextFromParts.length >= retryTextFromGetter.length
          ? retryTextFromParts
          : retryTextFromGetter;
    }

    debugInfo = {
      path: "non-stream",
      textFromGetterLength: textFromGetter.length,
      textFromPartsLength: textFromParts.length,
      finishReason: resAny.candidates?.[0]?.finishReason,
      candidateTokenCount: resAny.candidates?.[0]?.tokenCount,
      usageMetadata: resAny.usageMetadata,
      partsCount: resAny.candidates?.[0]?.content?.parts?.length ?? 0,
    };

    const replyBeforeReplace = reply.trim();
    // 마크다운 볼드 등이 붙어 나온 경우 제거 (평문만 노출)
    reply = replyBeforeReplace.replace(/\*\*(.+?)\*\*/g, "$1");
    const { max } = LENGTH_RANGE[lengthKey];
    // 모델이 길이 지시를 벗어나도 데모 응답은 길이 상한을 강제한다.
    reply = enforceMaxLengthBySentence(reply, max);

    const debugPayload = {
      ...debugInfo,
      replyLengthFinal: reply.length,
      replyLengthBeforeReplace: replyBeforeReplace.length,
      replyEndSnippet: reply.slice(-80),
      endsWithCompleteSentence: /[.!?]\s*$/.test(reply) || reply.length === 0,
    };

    // 디버깅: 잘림 원인 분석용 로그 (서버 콘솔, pnpm dev 터미널에 출력)
    console.log("[demo/review-reply] DEBUG", debugPayload);

    const result: { reply: string; _debug?: typeof debugPayload } = {
      reply: reply || "답변을 생성하지 못했어요. 다시 시도해 주세요.",
    };
    // 요청 헤더에 X-Debug: 1 있거나 쿼리/바디에 debug=1 있으면 응답에 _debug 포함 (원인 분석용)
    const wantDebug =
      request.headers.get("x-debug") === "1" ||
      request.nextUrl.searchParams.get("debug") === "1";
    if (wantDebug) {
      result._debug = debugPayload;
    }

    return NextResponse.json<AppRouteHandlerResponse<{ reply: string }>>({
      result: result as { reply: string },
    });
  } catch (e) {
    console.error("[demo/review-reply]", e);
    throw new AppError({
      code: "DEMO_REPLY_FAILED",
      message: "AI 생성 실패",
      detail: "잠시 후 다시 시도해 주세요.",
    });
  }
}

export const POST = withRouteHandler(postHandler);
