import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/db/supabase-server";
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
  const industryFromSettings = toneSettings?.industry?.trim();
  const customerSegmentFromSettings = toneSettings?.customer_segment?.trim();

  const content = review.content ?? "(내용 없음)";
  const rating = review.rating ?? 0;
  const authorName = review.author_name?.trim() ?? "고객";
  const menus =
    review.menus && review.menus.length > 0
      ? review.menus.join(", ")
      : "(없음)";

  const 업종FromPlatform = await getShopCategoryForStore(
    review.store_id,
    userId,
  );
  const 업종Display =
    industryFromSettings ||
    업종FromPlatform ||
    store.name ||
    "(미설정)";
  const 주요고객층Display = customerSegmentFromSettings || "(미설정)";

  const params: ReviewReplyPromptParams = {
    업종: 업종Display,
    주요_고객층: 주요고객층Display,
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

  const systemPrompt = buildReviewReplySystemPrompt(tone, commentLength, params);
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
    const draft =
      text ??
      getMockDraft({
        authorName,
        menus: review.menus ?? null,
        content,
        rating,
      });
    // 마케팅 문구는 Gemini 댓글 다음 문단에 항상 원문 그대로 붙임
    return extra ? `${draft}\n\n${extra}` : draft;
  } catch {
    const draft = getMockDraft({
      authorName,
      menus: review.menus ?? null,
      content,
      rating,
    });
    return extra ? `${draft}\n\n${extra}` : draft;
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

/**
 * 자동 등록(sync 결과 적용) 시 초안이 없는 미답변 리뷰용. RLS 없이 service role로 리뷰/톤/매장 조회 후 AI 초안 생성.
 */
export async function generateDraftContentWithServiceRole(
  reviewId: string
): Promise<string> {
  const supabase = createServiceRoleClient();

  const { data: reviewRow, error: reviewError } = await supabase
    .from("reviews")
    .select("id, store_id, content, rating, author_name, menus")
    .eq("id", reviewId)
    .single();

  if (reviewError || !reviewRow) {
    throw new Error(`Review not found: ${reviewId}`);
  }

  const storeId = reviewRow.store_id as string;
  const content = (reviewRow.content as string) ?? "(내용 없음)";
  const rating = (reviewRow.rating as number) ?? 0;
  const authorName = ((reviewRow.author_name as string) ?? "고객").trim();
  const rawMenus = reviewRow.menus;
  const menus: string[] = Array.isArray(rawMenus)
    ? rawMenus.filter((m): m is string => typeof m === "string" && m.trim() !== "")
    : [];
  const menusDisplay = menus.length > 0 ? menus.join(", ") : "(없음)";

  const { data: toneRow } = await supabase
    .from("tone_settings")
    .select("tone, comment_length, extra_instruction, industry, customer_segment")
    .eq("store_id", storeId)
    .maybeSingle();

  const tone = (toneRow?.tone as string) ?? "default";
  const commentLength = (toneRow?.comment_length as string) ?? "normal";
  const extra = ((toneRow?.extra_instruction as string) ?? "").trim();
  const industryFromSettings = (toneRow?.industry as string)?.trim();
  const customerSegmentFromSettings = (toneRow?.customer_segment as string)?.trim();

  const { data: storeRow } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .single();
  const storeName = (storeRow?.name as string)?.trim();

  const { data: sessionRow } = await supabase
    .from("store_platform_sessions")
    .select("shop_category")
    .eq("store_id", storeId)
    .not("shop_category", "is", null)
    .limit(1)
    .maybeSingle();
  const 업종Display =
    industryFromSettings ||
    (sessionRow?.shop_category as string) ||
    storeName ||
    "(미설정)";
  const 주요고객층Display = customerSegmentFromSettings || "(미설정)";

  const params: ReviewReplyPromptParams = {
    업종: 업종Display,
    주요_고객층: 주요고객층Display,
    닉네임: authorName,
    메뉴: menusDisplay,
    별점: `${rating}점`,
    리뷰_내용: content,
  };

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return getMockDraft({
      authorName,
      menus: menus.length > 0 ? menus : null,
      content,
      rating,
    });
  }

  const systemPrompt = buildReviewReplySystemPrompt(tone, commentLength, params);
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
    const draft =
      text ??
      getMockDraft({
        authorName,
        menus: menus.length > 0 ? menus : null,
        content,
        rating,
      });
    // 마케팅 문구는 Gemini 댓글 다음 문단에 항상 원문 그대로 붙임
    return extra ? `${draft}\n\n${extra}` : draft;
  } catch {
    const draft = getMockDraft({
      authorName,
      menus: menus.length > 0 ? menus : null,
      content,
      rating,
    });
    return extra ? `${draft}\n\n${extra}` : draft;
  }
}
