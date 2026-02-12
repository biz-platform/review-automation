import { z } from "zod";

export const toneSchema = z.enum(["friendly", "formal", "casual"]);

export const toneSettingsSchema = z.object({
  tone: toneSchema.optional().default("friendly"),
  extra_instruction: z.string().optional().nullable(),
});

export type ToneSettingsDto = z.infer<typeof toneSettingsSchema>;

export type ToneSettingsResponse = {
  store_id: string;
  tone: string;
  extra_instruction: string | null;
  updated_at: string;
};
