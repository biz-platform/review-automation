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
import { getGeminiApiKeyFromEnv } from "@/lib/config/gemini-review-reply";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { extractGeminiReplyVisibleText } from "@/lib/utils/ai/extract-gemini-reply-visible-text";
import { generateGeminiReviewReplyText } from "@/lib/utils/ai/review-reply-gemini-run";
import { sanitizeReviewReplyDraft } from "@/lib/utils/ai/sanitize-review-reply";
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

/** 한글 답글에서 '여기까지 자르면' 덜 어색한 끝 위치(배타 인덱스) 탐색 */
function lastKoreanFriendlyBoundaryEnd(s: string, minEnd: number): number {
  let best = -1;
  const punct = /[.!?。！？]+/gu;
  for (const m of s.matchAll(punct)) {
    const end = m.index! + m[0].length;
    if (end >= minEnd && end <= s.length) best = end;
  }
  const kor =
    /(?:습니다|습니까|합니다|입니다|했습니다|드립니다|감사합니다|죄송합니다|바랍니다|겠습니다|부탁드립니다|알겠습니다|있습니다|없습니다|주세요|할게요|드릴게요|뵙겠습니다|찾아주세요|해요|예요|이에요|네요|어요|있어요|없어요|군요|죠)(?=\s*$|[,，]|[.!?。！？]|$)/gu;
  for (const m of s.matchAll(kor)) {
    const end = m.index! + m[0].length;
    if (end >= minEnd && end <= s.length) best = end;
  }
  return best;
}

function enforceMaxLengthBySentence(reply: string, max: number): string {
  const trimmed = reply.trim();
  if (trimmed.length <= max) return trimmed;
  const sliced = trimmed.slice(0, max);
  const minKeep = Math.max(24, Math.floor(max * 0.5));

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

  const korEnd = lastKoreanFriendlyBoundaryEnd(sliced, minKeep);
  if (korEnd > 0) {
    return sliced.slice(0, korEnd).trim();
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
    const { text: rawReply, finishReason, lastResponse: res } =
      await generateGeminiReviewReplyText({
        ai,
        userPrompt,
        systemPrompt,
        starRating: rating,
      });
    let reply = rawReply;

    const resAny = res as {
      text?: string;
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        finishReason?: string;
        tokenCount?: number;
      }>;
      usageMetadata?: {
        totalTokenCount?: number;
        candidatesTokenCount?: number;
        totalOutputTokenCount?: number;
      };
    };

    const extractedMeta = extractGeminiReplyVisibleText(res);

    const debugInfo = {
      path: "non-stream",
      textFromGetterLength: extractedMeta.fromGetterLen,
      textFromPartsLength: extractedMeta.fromPartsLen,
      finishReason: finishReason ?? resAny.candidates?.[0]?.finishReason,
      candidateTokenCount: resAny.candidates?.[0]?.tokenCount,
      usageMetadata: resAny.usageMetadata,
      partsCount: resAny.candidates?.[0]?.content?.parts?.length ?? 0,
    };

    reply = sanitizeReviewReplyDraft(reply, { starRating: rating });
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
