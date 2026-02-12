import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { ReviewService } from "@/lib/services/review-service";
import { ToneSettingsService } from "@/lib/services/tone-settings-service";
import OpenAI from "openai";

const reviewService = new ReviewService();
const toneSettingsService = new ToneSettingsService();

export async function generateDraftContent(reviewId: string, userId: string): Promise<string> {
  const review = await reviewService.findById(reviewId, userId);
  const toneSettings = await toneSettingsService.getByStoreId(review.store_id, userId);
  const tone = toneSettings?.tone ?? "friendly";
  const extra = toneSettings?.extra_instruction ?? "";
  const content = review.content ?? "(내용 없음)";
  const rating = review.rating ?? 0;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return getMockDraft(tone, content, rating);
  }

  const openai = new OpenAI({ apiKey });
  const systemPrompt = `당신은 매장 리뷰에 답글을 작성하는 담당자입니다. 말투: ${tone}.${extra ? ` 추가 지침: ${extra}` : ""}`;
  const userPrompt = `다음 리뷰에 친절하고 전문적인 답글 초안을 한 문단으로 작성해 주세요. 평점: ${rating}점. 리뷰 내용: ${content}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 300,
    });
    const text = completion.choices[0]?.message?.content?.trim();
    return text ?? getMockDraft(tone, content, rating);
  } catch {
    return getMockDraft(tone, content, rating);
  }
}

function getMockDraft(tone: string, content: string, rating: number): string {
  return `[${tone} 말투 초안] ${rating}점 리뷰 감사합니다. "${content.slice(0, 50)}${content.length > 50 ? "…" : ""}"에 대해 검토 후 더 나은 서비스로 보답하겠습니다.`;
}
