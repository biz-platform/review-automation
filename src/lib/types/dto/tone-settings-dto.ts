import { z } from "zod";

/** 우리 가게 맞춤 AI: 기본 말투, 2030 여자/남자, 4050 사장님. 기존 friendly/formal/casual 호환 */
export const toneSchema = z.enum([
  "default",
  "female_2030",
  "male_2030",
  "senior_4050",
  "friendly",
  "formal",
  "casual",
]);

export const commentLengthSchema = z.enum(["short", "normal", "long"]);

/** 댓글 등록 방식: direct(직접 등록) | auto(자동 등록) */
export const commentRegisterModeSchema = z.enum(["direct", "auto"]);

/** 자동 등록 실행 시각(0~23, 서버 시간). comment_register_mode=auto일 때만 사용 */
export const autoRegisterScheduledHourSchema = z
  .number()
  .int()
  .min(0)
  .max(23)
  .optional()
  .nullable();

export const toneSettingsSchema = z.object({
  tone: toneSchema,
  extra_instruction: z.string().optional().nullable(),
  comment_length: commentLengthSchema,
  comment_register_mode: commentRegisterModeSchema.optional(),
  /** 자동 등록 시 매일 실행할 시각(0~23). auto일 때만 유효 */
  auto_register_scheduled_hour: autoRegisterScheduledHourSchema,
  /** 매장 정보: 업종 (AI 댓글 작성 참고) */
  industry: z.string().optional().nullable(),
  /** 매장 정보: 주요 고객층 (AI 댓글 작성 참고) */
  customer_segment: z.string().optional().nullable(),
});

export type ToneSettingsDto = z.infer<typeof toneSettingsSchema>;

export type ToneSettingsResponse = {
  store_id: string;
  tone: string;
  extra_instruction: string | null;
  comment_length: string;
  comment_register_mode: "direct" | "auto";
  /** 0-23. 자동 등록 시 사용 */
  auto_register_scheduled_hour: number | null;
  industry: string | null;
  customer_segment: string | null;
  updated_at: string;
};
