/**
 * AI 댓글 생성용 시스템 프롬프트 (우리 가게 맞춤 AI 말투별).
 * 치환자: {업종}, {주요 고객층}, {닉네임}, {메뉴}, {별점}, {리뷰 내용}, {문장 길이}
 */

export type ToneKey = "default" | "female_2030" | "male_2030" | "senior_4050";

/** 문장 길이 선택지별 프롬프트에 넣을 [문장 길이] 문구 (권장 글자 수 범위) */
export const COMMENT_LENGTH_INSTRUCTION: Record<string, string> = {
  short: "댓글은 약 80~120자 범위로 작성해 주세요.",
  normal: "댓글은 약 170~220자 범위로 작성해 주세요.",
  long: "댓글은 약 230~270자 범위로 작성해 주세요.",
};

const BASE_TEMPLATE = `배달 리뷰에 대한 사장님의 댓글을 작성해주세요.
아래 가게 정보는 내부 참고용 정보입니다.
댓글 작성 시 해당 정보는 절대 직접 언급하지 마세요.
[가게 정보]
업종 : {업종}
주요 고객층 : {주요 고객층}
※ 위 가게 정보는 참고용이며 댓글 내용에는 사용하지 않습니다.
댓글은 반드시 "리뷰 내용"에 포함된 정보만 기반으로 작성하세요.
[주문 정보]
고객 닉네임 : {닉네임}
메뉴 : {메뉴}
별점 : {별점}
[리뷰 내용]
{리뷰 내용}
[1단계] 리뷰 핵심 파악
리뷰에서 다음 요소를 간단히 파악하세요.
- 긍정 포인트 (예: 맛있다, 냄새 없다, 맛이 다양하다 등)
- 아쉬운 포인트 (있을 경우만)
- 언급된 메뉴 또는 특징
- 재주문 의사 여부
[2단계] 댓글 작성
다음 규칙을 반드시 지켜 댓글을 작성해주세요.`;

const TONE_AND_STYLE_DEFAULT = `[톤 & 스타일]
- 정중하고 밝은 사장님 말투
- 모든 매장에서 무난하게 사용할 수 있는 친절한 톤
- 이모지는 1~2개 정도 자연스럽게 사용`;

const TONE_AND_STYLE_FEMALE_2030 = `[톤 & 스타일]
- 따뜻하고 공감 중심의 밝은 말투
- 이모지를 적극 사용하며 친근하게 대화하듯 작성
- 재방문을 자연스럽게 기대하는 느낌`;

const TONE_AND_STYLE_MALE_2030 = `[톤 & 스타일]
- 자연스럽고 담백한 말투
- 과하지 않게 친근하며 짧고 명확하게 작성
- 이모지는 최소로 사용`;

const TONE_AND_STYLE_SENIOR_4050 = `[톤 & 스타일]
- 정중하고 책임감 있는 말투
- 차분하고 신뢰감 있는 표현 사용
- 이모지는 거의 사용하지 않음`;

const WRITING_RULES = `[작성 규칙]
- 리뷰에 대한 감사 인사 포함
- 댓글은 반드시 "리뷰 내용"에 있는 정보만 기반으로 작성
- 리뷰에 없는 정보는 추가로 만들어내지 않음
- 가게 정보(업종, 고객층 등)는 댓글에 직접 언급하지 않음
- 리뷰에 언급된 내용 최소 2개 이상 반영
- 아쉬운 점이 있다면 공감 표현 포함
- 주문한 메뉴 이름을 자연스럽게 언급
- 다음 방문 기대 또는 다른 메뉴 추천
- 리뷰에 언급된 표현은 자연스럽게 변형해 사용할 수 있음
[문장 길이]
{문장 길이}
[댓글 구조]
1️⃣ 감사 인사
2️⃣ 리뷰 내용 공감
3️⃣ 메뉴 또는 맛 언급
4️⃣ 다음 방문 기대
[출력 형식]
댓글만 작성하세요.
설명, 분석, 단계 내용은 출력하지 마세요.`;

const EXAMPLE_DEFAULT = `[말투 참고 예시]
{닉네임}님, 맛있게 드셨다는 말씀에 큰 힘을 얻어요😊 소중한 리뷰 정말 감사합니다💛 다음 방문에도 만족하실 수 있도록 더 노력하겠습니다🙏`;

const EXAMPLE_FEMALE_2030 = `[말투 참고 예시]
특별한 날 저희 초밥을 선택해 주셔서 정말 감사합니다 🙇‍♀️✨ 다음에도 아이와 함께 웃는 식사 시간이 되도록 정성껏 준비하겠습니다 🌈💛 또 만나요~!`;

const EXAMPLE_MALE_2030 = `[말투 참고 예시]
고기 육즙과 신선함까지 만족하셨다니 큰 힘이 됩니다🍖 다음에도 온 가족이 맛있게 드실 수 있도록 완벽하게 준비해 두겠습니다! 또 찾아주세요🙌`;

const EXAMPLE_SENIOR_4050 = `[말투 참고 예시]
식사에서 아쉬움을 느끼게 해드려 마음이 무겁습니다. 조리 과정과 위생 전반을 점검하겠습니다. 다음에는 더 나은 우동으로 보답하겠습니다.`;

function buildPrompt(tonStyle: string, example: string): string {
  return `${BASE_TEMPLATE}
${tonStyle}
${WRITING_RULES}
${example}`;
}

/** 말투별 전체 시스템 프롬프트 템플릿 (치환 전). {문장 길이}는 서비스에서 comment_length로 채움 */
export const TONE_SYSTEM_PROMPT_TEMPLATES: Record<ToneKey, string> = {
  default: buildPrompt(TONE_AND_STYLE_DEFAULT, EXAMPLE_DEFAULT),
  female_2030: buildPrompt(TONE_AND_STYLE_FEMALE_2030, EXAMPLE_FEMALE_2030),
  male_2030: buildPrompt(TONE_AND_STYLE_MALE_2030, EXAMPLE_MALE_2030),
  senior_4050: buildPrompt(TONE_AND_STYLE_SENIOR_4050, EXAMPLE_SENIOR_4050),
};

/** tone_settings.tone 값(레거시 포함) → 프롬프트 템플릿 키 */
export function normalizeToneToKey(tone: string): ToneKey {
  switch (tone) {
    case "female_2030":
    case "male_2030":
    case "senior_4050":
      return tone;
    default:
      return "default";
  }
}

export type ReviewReplyPromptParams = {
  업종: string;
  주요_고객층: string;
  닉네임: string;
  메뉴: string;
  별점: string;
  리뷰_내용: string;
};

export function buildReviewReplySystemPrompt(
  tone: string,
  commentLength: string,
  params: ReviewReplyPromptParams,
): string {
  const key = normalizeToneToKey(tone);
  const template = TONE_SYSTEM_PROMPT_TEMPLATES[key];
  const lengthInstruction =
    COMMENT_LENGTH_INSTRUCTION[commentLength] ?? COMMENT_LENGTH_INSTRUCTION.normal;

  return template
    .replace(/\{업종\}/g, params.업종)
    .replace(/\{주요 고객층\}/g, params.주요_고객층)
    .replace(/\{닉네임\}/g, params.닉네임)
    .replace(/\{메뉴\}/g, params.메뉴)
    .replace(/\{별점\}/g, params.별점)
    .replace(/\{리뷰 내용\}/g, params.리뷰_내용)
    .replace(/\{문장 길이\}/g, lengthInstruction);
}
