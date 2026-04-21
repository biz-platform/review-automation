import { z } from "zod";
import { paginationSchema } from "./common-dto";

export const platformSchema = z.enum([
  "naver",
  "baemin",
  "yogiyo",
  "coupang_eats",
  "ddangyo",
]);

export const reviewListFilterSchema = z.enum(["all", "unanswered", "answered", "expired"]);
export type ReviewListFilter = z.infer<typeof reviewListFilterSchema>;

export const reviewListQuerySchema = paginationSchema.extend({
  store_id: z.string().uuid().optional(),
  platform_shop_external_id: z.string().trim().min(1).optional(),
  rating_lte: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v == null || v === "" ? undefined : Number(v)))
    .refine((v) => v == null || (!Number.isNaN(v) && v >= 1 && v <= 5), {
      message: "rating_lte must be a number between 1 and 5",
    }),
  platform: platformSchema
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  linked_only: z
    .union([z.literal("true"), z.literal("1")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
  filter: reviewListFilterSchema.optional().default("all"),
  include_drafts: z
    .union([z.literal("true"), z.literal("1")])
    .optional()
    .transform((v) => v === "true" || v === "1"),
});

export type ReviewListQueryDto = z.infer<typeof reviewListQuerySchema>;

export type ReviewImage = { imageUrl: string };

/** 목록에서 include_drafts=true 시 함께 내려주는 draft 요약 */
export type ReviewReplyDraftSummary = {
  draft_content: string;
  approved_content: string | null;
};

export type ReviewResponse = {
  id: string;
  store_id: string;
  platform: string;
  /** DB NOT NULL — 플랫폼 리뷰 식별자 */
  external_id: string;
  rating: number | null;
  content: string | null;
  author_name: string | null;
  written_at: string | null;
  created_at: string;
  images?: ReviewImage[];
  /** 주문 메뉴명 목록 (배민 menus[].name 등) */
  menus?: string[];
  platform_reply_content: string | null;
  /** 배민: 가게 외(운영자·CS 등) 노출 답글. 사장님 답(`platform_reply_content`)과 별도 */
  platform_operator_reply_content?: string | null;
  /** 플랫폼 답글 ID (쿠팡이츠 orderReviewReplyId 등). 수정/삭제 시 사용 */
  platform_reply_id?: string | null;
  /** 배민 shopNo 등 — 다매장 계정에서 답글 URL 컨텍스트 */
  platform_shop_external_id?: string | null;
  /** include_drafts=true 일 때만 존재 */
  reply_draft?: ReviewReplyDraftSummary;
};
