/** AI 댓글 설정 탭 id (mobileLabel 있으면 모바일에서 해당 텍스트 사용) */
export const AI_SETTINGS_TABS = [
  { value: "custom-ai", label: "우리 가게 맞춤 AI", mobileLabel: "맞춤 AI" },
  { value: "comment-register", label: "댓글 등록" },
  { value: "store-info", label: "매장 정보" },
  { value: "marketing", label: "마케팅" },
] as const;

export type AiSettingsTabValue = (typeof AI_SETTINGS_TABS)[number]["value"];

/** AI 말투 옵션 (value = API/DB 값). description은 문장별 줄바꿈용 \n 포함 */
export const AI_TONE_OPTIONS = [
  {
    value: "default",
    label: "기본 말투",
    description:
      "정중하면서도 밝은 말투로 답글을 작성해요\n모든 매장에 무난하게 사용할 수 있어요",
    example:
      "알사탕님, 소중한 리뷰 정말 감사합니다❤️😊 다음 방문에도 만족하실 수 있도록 더 노력하겠습니다.🙏🏻",
  },
  {
    value: "female_2030",
    label: "2030대 여자 사장님",
    description:
      "따뜻하고 밝은 말투로 공감을 담아 답글을 작성해요\n이모지를 활발하게 사용하면서 재방문을 자연스럽게 유도해요",
    example:
      "특별한 날 저희 초밥을 선택해 주셔서 정말 감사합니다 ✨ 다음에도 아이와 함께 웃는 식사 시간이 되도록 정성껏 준비하겠습니다 🌈 또 만나요~!",
  },
  {
    value: "male_2030",
    label: "2030대 남자 사장님",
    description:
      "자연스럽고 담백한 톤으로 답글을 작성해요\n과하지 않게 친근하며, 짧고 명확한 문장으로 핵심만 전달해요",
    example:
      "고기 육즙과 신선함까지 만족하셨다니 큰 힘이 됩니다. 다음에도 온 가족이 맛있게 드실 수 있도록 완벽하게 준비해 두겠습니다! 또 찾아주세요 🙏🏻",
  },
  {
    value: "senior_4050",
    label: "4050대 사장님",
    description:
      "정중하고 책임감 있는 표현으로 답글을 작성해요\n이모지는 거의 사용하지 않고 진중하면서 차분하게 신뢰와 정성을 전달해요",
    example:
      "식사에서 아쉬움을 느끼게 해드려 마음이 무겁습니다. 조리 과정과 위생 전반을 점검하겠습니다. 다음에는 더 나은 우동으로 보답하겠습니다^^",
  },
] as const;

/** 댓글 등록 방식 (Figma 202-2391, 213-2945). 기본값: 직접 등록 */
export const COMMENT_REGISTER_OPTIONS = [
  { value: "direct", label: "직접 등록" },
  { value: "auto", label: "자동 등록" },
] as const;

export type CommentRegisterMode =
  (typeof COMMENT_REGISTER_OPTIONS)[number]["value"];

/** AI 댓글 길이 옵션 */
export const AI_LENGTH_OPTIONS = [
  { value: "short", label: "짧게 (약 100자)" },
  { value: "normal", label: "보통 (약 200자)" },
  { value: "long", label: "길게 (250자 이상)" },
] as const;

/** 마케팅 설정 텍스트 최대 길이 */
export const MARKETING_TEXT_MAX_LENGTH = 100;

/** 마케팅 문구 입력 시 댓글 길이 최대 (자) → '보통'까지만 선택 가능 */
export const MARKETING_MAX_LENGTH_CHARS = 200;
