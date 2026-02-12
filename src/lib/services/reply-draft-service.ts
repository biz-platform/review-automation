import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { ReviewService } from "@/lib/services/review-service";
import type { ReplyDraftResponse } from "@/lib/types/dto/reply-dto";

const reviewService = new ReviewService();

export class ReplyDraftService {
  async getByReviewId(reviewId: string, userId: string): Promise<ReplyDraftResponse | null> {
    await reviewService.findById(reviewId, userId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("reply_drafts")
      .select("*")
      .eq("review_id", reviewId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return rowToDraft(data);
  }

  async createDraft(reviewId: string, draftContent: string, userId: string): Promise<ReplyDraftResponse> {
    await reviewService.findById(reviewId, userId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("reply_drafts")
      .upsert(
        {
          review_id: reviewId,
          draft_content: draftContent,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "review_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return rowToDraft(data);
  }

  async approve(reviewId: string, userId: string, approvedContent: string): Promise<ReplyDraftResponse> {
    await reviewService.findById(reviewId, userId);
    const supabase = await createServerSupabaseClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("reply_drafts")
      .update({
        status: "approved",
        approved_content: approvedContent,
        approved_at: now,
        updated_at: now,
      })
      .eq("review_id", reviewId)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      throw new AppNotFoundError({
        ...ERROR_CODES.REPLY_DRAFT_NOT_FOUND,
        detail: `No draft for review ${reviewId}`,
      });
    }
    return rowToDraft(data);
  }
}

function rowToDraft(row: Record<string, unknown>): ReplyDraftResponse {
  return {
    id: row.id as string,
    review_id: row.review_id as string,
    draft_content: row.draft_content as string,
    status: row.status as string,
    approved_content: (row.approved_content as string) ?? null,
    approved_at: row.approved_at != null ? (row.approved_at as string) : null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
