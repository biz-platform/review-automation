import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import type { ReviewListQueryDto, ReviewResponse } from "@/lib/types/dto/review-dto";

export class ReviewService {
  async findAll(
    _userId: string,
    query: ReviewListQueryDto
  ): Promise<{ list: ReviewResponse[]; count: number }> {
    const supabase = await createServerSupabaseClient();
    let storeIdsFilter: string[] | null = null;
    if (query.linked_only && query.platform) {
      const { data: sessions } = await supabase
        .from("store_platform_sessions")
        .select("store_id")
        .eq("platform", query.platform);
      storeIdsFilter = (sessions ?? []).map((r: { store_id: string }) => r.store_id);
      if (storeIdsFilter.length === 0) {
        return { list: [], count: 0 };
      }
    }

    let q = supabase.from("reviews").select("*", { count: "exact" });
    if (query.store_id) q = q.eq("store_id", query.store_id);
    if (query.platform) q = q.eq("platform", query.platform);
    if (storeIdsFilter?.length) q = q.in("store_id", storeIdsFilter);
    q = q.order("created_at", { ascending: false }).range(query.offset, query.offset + query.limit - 1);

    const { data, error, count } = await q;

    if (error) throw error;
    const list = (data ?? []).map((row: Record<string, unknown>) => rowToReview(row));
    return { list, count: count ?? 0 };
  }

  async findById(id: string, _userId: string): Promise<ReviewResponse> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.from("reviews").select("*").eq("id", id).single();

    if (error || !data) {
      throw new AppNotFoundError({
        ...ERROR_CODES.REVIEW_NOT_FOUND,
        detail: `Review ${id} not found`,
      });
    }
    return rowToReview(data);
  }

  /** MVP: mock collect — insert dummy review for the store of the given review */
  async collectMock(reviewId: string, userId: string): Promise<{ collected: number }> {
    const review = await this.findById(reviewId, userId);
    return this.insertOneMockReview(review.store_id, review.platform);
  }

  /** MVP: mock collect by store (when no reviews yet) */
  async collectMockByStore(storeId: string, userId: string): Promise<{ collected: number }> {
    const { StoreService } = await import("@/lib/services/store-service");
    const storeService = new StoreService();
    await storeService.findById(storeId, userId);
    return this.insertOneMockReview(storeId, "naver");
  }

  /** 배민 브라우저 캡처 결과를 DB에 upsert (연동/동기화 시 사용) */
  async upsertBaeminReviews(
    storeId: string,
    _userId: string,
    items: Array<{
      id: number;
      contents?: string | null;
      rating?: number | null;
      memberNickname?: string | null;
      createdAt?: string | null;
    }>
  ): Promise<{ upserted: number }> {
    console.log("[ReviewService.upsertBaeminReviews]", {
      itemsLength: items.length,
      firstItemKeys: items[0] != null ? Object.keys(items[0]) : null,
    });
    if (items.length === 0) return { upserted: 0 };
    const supabase = await createServerSupabaseClient();
    const rows = items.map((r) => ({
      store_id: storeId,
      platform: "baedal",
      external_id: String(r.id),
      rating: r.rating != null ? Math.round(Number(r.rating)) : null,
      content: r.contents ?? null,
      author_name: r.memberNickname ?? null,
      written_at: r.createdAt ?? null,
    }));
    const { error } = await supabase.from("reviews").upsert(rows, {
      onConflict: "store_id,platform,external_id",
    });
    if (error) throw error;
    return { upserted: rows.length };
  }

  private async insertOneMockReview(
    storeId: string,
    platform: string
  ): Promise<{ collected: number }> {
    const supabase = await createServerSupabaseClient();
    const dummy = {
      store_id: storeId,
      platform,
      external_id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      rating: 4,
      content: "목데이터 리뷰입니다.",
      author_name: "목데이터",
    };
    const { error } = await supabase.from("reviews").insert(dummy);
    if (error) throw error;
    return { collected: 1 };
  }
}

function rowToReview(row: Record<string, unknown>): ReviewResponse {
  return {
    id: row.id as string,
    store_id: row.store_id as string,
    platform: row.platform as string,
    external_id: (row.external_id as string) ?? null,
    rating: (row.rating as number) ?? null,
    content: (row.content as string) ?? null,
    author_name: (row.author_name as string) ?? null,
    written_at: row.written_at != null ? (row.written_at as string) : null,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
  };
}
