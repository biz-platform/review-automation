import { z } from "zod";
import { paginationSchema } from "./common-dto";

export const platformSchema = z.enum([
  "naver",
  "baemin",
  "yogiyo",
  "coupang_eats",
  "ddangyo",
]);

export const reviewListQuerySchema = paginationSchema.extend({
  store_id: z.string().uuid().optional(),
  platform: platformSchema
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  linked_only: z
    .union([z.literal("true"), z.literal("1")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type ReviewListQueryDto = z.infer<typeof reviewListQuerySchema>;

export type ReviewImage = { imageUrl: string };

export type ReviewResponse = {
  id: string;
  store_id: string;
  platform: string;
  external_id: string | null;
  rating: number | null;
  content: string | null;
  author_name: string | null;
  written_at: string | null;
  created_at: string;
  images?: ReviewImage[];
};
