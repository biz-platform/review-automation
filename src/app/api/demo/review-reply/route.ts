import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  buildReviewReplySystemPrompt,
  normalizeToneToKey,
  type ToneKey,
} from "@/lib/prompts/review-reply-prompts";
import { GoogleGenAI } from "@google/genai";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { AppBadRequestError, AppError } from "@/lib/errors/app-error";

const GEMINI_MODEL = "gemini-2.5-flash";

const bodySchema = z.object({
  storeName: z.string().max(100).optional(),
  rating: z.number().int().min(1).max(5),
  nickname: z.string().max(50).optional(),
  menu: z.string().max(200).optional(),
  reviewText: z.string().min(1, "리뷰 내용을 입력해주세요").max(2000),
  tone: z
    .enum(["default", "female_2030", "male_2030", "senior_4050"])
    .optional(),
});

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
  const { storeName, rating, nickname, menu, reviewText, tone } = parsed.data;

  const toneKey: ToneKey = tone ? normalizeToneToKey(tone) : "default";
  const params = {
    업종: (storeName?.trim() || "(체험)").slice(0, 50),
    주요_고객층: "(미설정)",
    닉네임: (nickname?.trim() || "고객").slice(0, 30),
    메뉴: (menu?.trim() || "(없음)").slice(0, 200),
    별점: `${rating}점`,
    리뷰_내용: reviewText.trim().slice(0, 2000),
  };

  const systemPrompt = buildReviewReplySystemPrompt(toneKey, "normal", params);
  // 사용자 턴에 리뷰 본문 + 길이 지시를 넣어야 모델이 충분히 긴 댓글을 생성함 (시스템만으로는 짧게 나오는 경우 많음)
  const userPrompt = `위 지침에 따라 아래 리뷰에 대한 사장님 댓글만 작성해 주세요.
- 댓글은 **120자 이상 170자 이하**로 작성할 것. 한두 문장으로 끝내지 말 것.
- 감사 인사 → 리뷰 공감 → 메뉴/맛 언급 → 다음 방문 기대 순으로 완전한 댓글을 작성할 것.
- 마크다운(** 등)이나 서식 없이 평문만 출력하세요.

[리뷰]
${params.리뷰_내용}`;

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    const fallback = `${params.닉네임}님, 소중한 리뷰 감사합니다. ${params.메뉴} 맛있게 드셨다니 기쁘네요. 다음에도 찾아주시면 감사하겠습니다.`;
    return NextResponse.json<AppRouteHandlerResponse<{ reply: string }>>({
      result: { reply: fallback },
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const genConfig = {
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1024,
        // Gemini 2.5 Flash는 기본으로 thinking(추론) 토큰을 쓰며, 이게 maxOutputTokens 안에서 소비돼 답변만 39토큰 남음 → thinking 끔
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    let reply = "";
    let debugInfo: Record<string, unknown> = { path: "unknown" };

    // 스트리밍은 청크 2개(~73자)만 오고 조기 종료되는 이슈 → non-stream 사용, candidates.parts에서 전체 텍스트 추출
    const res = await ai.models.generateContent(genConfig);
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
