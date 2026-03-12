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

export const toneSettingsSchema = z.object({
  tone: toneSchema,
  extra_instruction: z.string().optional().nullable(),
  comment_length: commentLengthSchema,
});

export type ToneSettingsDto = z.infer<typeof toneSettingsSchema>;

export type ToneSettingsResponse = {
  store_id: string;
  tone: string;
  extra_instruction: string | null;
  comment_length: string;
  updated_at: string;
};
