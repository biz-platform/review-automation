import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import {
  buildReviewReplySystemPrompt,
  type ReviewReplyPromptParams,
} from "@/lib/prompts/review-reply-prompts";
import { ReviewService } from "@/lib/services/review-service";
import { StoreService } from "@/lib/services/store-service";
import { ToneSettingsService } from "@/lib/services/tone-settings-service";
import { GoogleGenAI } from "@google/genai";

const reviewService = new ReviewService();
const toneSettingsService = new ToneSettingsService();
const storeService = new StoreService();

const GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

export async function generateDraftContent(
  reviewId: string,
  userId: string,
): Promise<string> {
  const review = await reviewService.findById(reviewId, userId);
  const toneSettings = await toneSettingsService.getByStoreId(
    review.store_id,
    userId,
  );
  const store = await storeService.findById(review.store_id, userId);

  const tone = toneSettings?.tone ?? "default";
  const commentLength = toneSettings?.comment_length ?? "normal";
  const extra = toneSettings?.extra_instruction?.trim() ?? "";

  const content = review.content ?? "(내용 없음)";
  const rating = review.rating ?? 0;
  const authorName = review.author_name?.trim() ?? "고객";
  const menus =
    review.menus && review.menus.length > 0
      ? review.menus.join(", ")
      : "(없음)";

  const 업종 = await getShopCategoryForStore(review.store_id, userId);
  const 업종Display = 업종 || store.name || "(미설정)";

  const params: ReviewReplyPromptParams = {
    업종: 업종Display,
    주요_고객층: "(미설정)",
    닉네임: authorName,
    메뉴: menus,
    별점: `${rating}점`,
    리뷰_내용: content,
  };

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return getMockDraft({
      authorName,
      menus: review.menus ?? null,
      content,
      rating,
    });
  }

  let systemPrompt = buildReviewReplySystemPrompt(tone, commentLength, params);
  if (extra) {
    systemPrompt += `\n\n[추가 지침]\n${extra}`;
  }

  const userPrompt = "위 지침에 따라 이 리뷰에 대한 댓글만 작성해 주세요.";

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 2048,
      },
    });
    const text = response.text?.trim();
    return (
      text ??
      getMockDraft({
        authorName,
        menus: review.menus ?? null,
        content,
        rating,
      })
    );
  } catch {
    return getMockDraft({
      authorName,
      menus: review.menus ?? null,
      content,
      rating,
    });
  }
}

/** 해당 매장의 플랫폼 세션 중 shop_category 하나 조회 (업종 참고용) */
async function getShopCategoryForStore(
  storeId: string,
  _userId: string,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("store_platform_sessions")
    .select("shop_category")
    .eq("store_id", storeId)
    .not("shop_category", "is", null)
    .limit(1)
    .maybeSingle();
  return (data?.shop_category as string) ?? null;
}

function getMockDraft(params: {
  authorName: string;
  menus: string[] | null;
  content: string;
  rating: number;
}): string {
  const { authorName, menus, content, rating } = params;
  const greeting = `저희 가게를 이용해주셔서 감사합니다, ${authorName}님.`;
  const menuLine =
    menus && menus.length > 0
      ? ` ${menus.join(", ")} 주문해 주셔서 감사합니다.`
      : "";
  const body =
    rating >= 4
      ? `소중한 ${rating}점과 따뜻한 말씀 감사합니다.${menuLine} 더 나은 맛과 서비스로 보답하겠습니다.`
      : `소중한 의견 감사합니다.${menuLine} 불편하신 점 반영해 개선하겠습니다.`;
  return `${greeting}${menuLine} ${body}`.replace(/\s+/g, " ").trim();
}
