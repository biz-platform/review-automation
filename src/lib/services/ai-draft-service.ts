import { ReviewService } from "@/lib/services/review-service";
import { ToneSettingsService } from "@/lib/services/tone-settings-service";
import { GoogleGenAI } from "@google/genai";

const reviewService = new ReviewService();
const toneSettingsService = new ToneSettingsService();

const GEMINI_MODEL = "gemini-2.5-flash";

export async function generateDraftContent(
  reviewId: string,
  userId: string,
): Promise<string> {
  const review = await reviewService.findById(reviewId, userId);
  const toneSettings = await toneSettingsService.getByStoreId(
    review.store_id,
    userId,
  );
  const tone = toneSettings?.tone ?? "friendly";
  const extra = toneSettings?.extra_instruction ?? "";
  const content = review.content ?? "(내용 없음)";
  const rating = review.rating ?? 0;
  const authorName = review.author_name?.trim() ?? "고객";
  const menus = review.menus && review.menus.length > 0 ? review.menus : null;

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return getMockDraft({ authorName, menus, content, rating });
  }

  const systemPrompt = [
    "당신은 매장 리뷰에 답글을 작성하는 담당자입니다.",
    `말투: ${tone}.`,
    extra ? `추가 지침: ${extra}` : "",
    "답글 규칙:",
    "1. 반드시 첫 문장으로 '저희 가게를 이용해주셔서 감사합니다, [작성자이름]님.' 형식으로 작성자 이름을 고정적으로 언급하며 인사한다.",
    "2. 리뷰에서 주문 메뉴가 언급되면 그 메뉴를 간단하게 언급한 뒤, 별점과 리뷰 내용을 바탕으로 구체적으로 답변한다.",
    "3. 긍정적인 리뷰(높은 별점·칭찬)라면 감사 인사를 담아 답한다.",
    "4. 아쉬움·불만·불편한 점이 조금이라도 있으면 반드시 죄송한 뉘앙스를 넣고, 언급된 불편 사항을 개선하겠다는 코멘트를 포함한다.",
  ]
    .filter(Boolean)
    .join("\n");

  const menuLine = menus ? `주문 메뉴: ${menus.join(", ")}\n` : "";
  const userPrompt = `다음 리뷰에 대한 답글 초안을 한 문단~두 문단으로 작성해 주세요. 위 규칙을 반드시 지킵니다.

${menuLine}평점: ${rating}점
리뷰 작성자 이름: ${authorName}
리뷰 내용: ${content}`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: 400,
      },
    });
    const text = response.text?.trim();
    return text ?? getMockDraft({ authorName, menus, content, rating });
  } catch {
    return getMockDraft({ authorName, menus, content, rating });
  }
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
