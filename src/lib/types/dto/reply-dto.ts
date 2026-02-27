import { z } from "zod";

export const updateDraftSchema = z.object({
  draft_content: z.string().min(1, "초안 내용은 필수입니다"),
});

/** POST 생성 시 초기 내용 지정(플랫폼 답글 수정용). 없으면 AI 생성 */
export const createDraftSchema = z.object({
  draft_content: z.string().min(1).optional(),
});

export const approveReplySchema = z.object({
  approved_content: z.string().min(1, "승인할 답글 내용은 필수입니다"),
});

export type ApproveReplyDto = z.infer<typeof approveReplySchema>;

export type ReplyDraftResponse = {
  id: string;
  review_id: string;
  draft_content: string;
  status: string;
  approved_content: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};
