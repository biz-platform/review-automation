import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import type {
  NormalizedReviewRow,
  PlatformCode,
} from "@/lib/types/dto/platform-dto";
import type {
  ReviewListQueryDto,
  ReviewReplyDraftSummary,
  ReviewResponse,
} from "@/lib/types/dto/review-dto";
import { getDefaultReviewDateRange } from "@/lib/utils/review-date-range";

export class ReviewService {
  async findAll(
    _userId: string,
    query: ReviewListQueryDto,
  ): Promise<{ list: ReviewResponse[]; count: number }> {
    const supabase = await createServerSupabaseClient();
    let storeIdsFilter: string[] | null = null;
    if (query.linked_only && query.platform) {
      const { data: sessions } = await supabase
        .from("store_platform_sessions")
        .select("store_id")
        .eq("platform", query.platform);
      storeIdsFilter = (sessions ?? []).map((r: unknown) =>
        (r as { store_id: string }).store_id,
      );
      if (storeIdsFilter.length === 0) {
        return { list: [], count: 0 };
      }
    }

    const { since } = getDefaultReviewDateRange();
    let q = supabase.from("reviews").select("*", { count: "exact" });
    if (query.store_id) q = q.eq("store_id", query.store_id);
    if (query.platform) q = q.eq("platform", query.platform);
    if (storeIdsFilter?.length) q = q.in("store_id", storeIdsFilter);
    q = q.gte("written_at", since.toISOString());

    const filter = query.filter ?? "all";
    if (filter === "unanswered") q = q.is("platform_reply_content", null);
    else if (filter === "answered") q = q.not("platform_reply_content", "is", null);
    else if (filter === "expired") {
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      q = q.not("written_at", "is", null).lt("written_at", fourteenDaysAgo);
    }

    q = q
      .order("written_at", { ascending: false, nullsFirst: false })
      .range(query.offset, query.offset + query.limit - 1);

    const { data, error, count } = await q;

    if (error) throw error;
    let list = (data ?? []).map((row: unknown) =>
      rowToReview(row as Record<string, unknown>),
    );

    if (query.include_drafts && list.length > 0) {
      const reviewIds = list.map((r) => r.id);
      const { data: drafts } = await supabase
        .from("reply_drafts")
        .select("review_id, draft_content, approved_content")
        .in("review_id", reviewIds);
      const draftByReviewId = new Map<string, ReviewReplyDraftSummary>();
      for (const d of drafts ?? []) {
        const row = d as { review_id: string; draft_content: string; approved_content: string | null };
        draftByReviewId.set(row.review_id, {
          draft_content: row.draft_content,
          approved_content: row.approved_content ?? null,
        });
      }
      list = list.map((r) => ({
        ...r,
        reply_draft: draftByReviewId.get(r.id),
      }));
    }

    return { list, count: count ?? 0 };
  }

  async findById(id: string, _userId: string): Promise<ReviewResponse> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      throw new AppNotFoundError({
        ...ERROR_CODES.REVIEW_NOT_FOUND,
        detail: `Review ${id} not found`,
      });
    }
    return rowToReview(data);
  }

  /** MVP: mock collect — insert dummy review for the store of the given review */
  async collectMock(
    reviewId: string,
    userId: string,
  ): Promise<{ collected: number }> {
    const review = await this.findById(reviewId, userId);
    return this.insertOneMockReview(review.store_id, review.platform);
  }

  /** MVP: mock collect by store (when no reviews yet) */
  async collectMockByStore(
    storeId: string,
    userId: string,
  ): Promise<{ collected: number }> {
    const { StoreService } = await import("@/lib/services/store-service");
    const storeService = new StoreService();
    await storeService.findById(storeId, userId);
    return this.insertOneMockReview(storeId, "naver");
  }

  /**
   * 플랫폼별 수집 리뷰를 DB에 upsert (배민/요기요/땡겨요/쿠팡이츠 공통).
   * @param toRow 플랫폼 API 응답 한 건을 NormalizedReviewRow로 변환하는 함수
   */
  async upsertPlatformReviews<T>(
    storeId: string,
    platform: PlatformCode,
    _userId: string,
    items: T[],
    toRow: (item: T) => NormalizedReviewRow,
  ): Promise<{ upserted: number }> {
    if (items.length === 0) return { upserted: 0 };
    const supabase = await createServerSupabaseClient();
    const rows = items.map((item) => {
      const r = toRow(item);
      return {
        store_id: storeId,
        platform,
        external_id: r.external_id,
        rating: r.rating != null ? Math.round(Number(r.rating)) : null,
        content: r.content ?? null,
        author_name: r.author_name ?? null,
        written_at: r.written_at ?? null,
      };
    });
    const { error } = await supabase.from("reviews").upsert(rows, {
      onConflict: "store_id,platform,external_id",
    });
    if (error) throw error;
    return { upserted: rows.length };
  }

  /** 배민 브라우저 캡처 결과를 DB에 upsert (upsertPlatformReviews + 배민 필드 매핑) */
  async upsertBaeminReviews(
    storeId: string,
    userId: string,
    items: Array<{
      id: number;
      contents?: string | null;
      rating?: number | null;
      memberNickname?: string | null;
      createdAt?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    return this.upsertPlatformReviews(
      storeId,
      "baemin",
      userId,
      items,
      (r) => ({
        external_id: String(r.id),
        rating: r.rating != null ? Math.round(Number(r.rating)) : null,
        content: r.contents ?? null,
        author_name: r.memberNickname ?? null,
        written_at: r.createdAt ?? null,
      }),
    );
  }

  /** 쿠팡이츠 리뷰 검색 API 결과를 DB에 upsert */
  async upsertCoupangEatsReviews(
    storeId: string,
    userId: string,
    items: Array<{
      orderReviewId: number;
      comment?: string | null;
      rating?: number | null;
      customerName?: string | null;
      createdAt?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    return this.upsertPlatformReviews(
      storeId,
      "coupang_eats",
      userId,
      items,
      (r) => ({
        external_id: String(r.orderReviewId),
        rating: r.rating != null ? Math.round(Number(r.rating)) : null,
        content: r.comment ?? null,
        author_name: r.customerName ?? null,
        written_at: r.createdAt ?? null,
      }),
    );
  }

  /** 요기요 리뷰 v2 API 결과를 DB에 upsert */
  async upsertYogiyoReviews(
    storeId: string,
    userId: string,
    items: Array<{
      id: number;
      comment?: string | null;
      rating?: number | null;
      nickname?: string | null;
      created_at?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    return this.upsertPlatformReviews(
      storeId,
      "yogiyo",
      userId,
      items,
      (r) => ({
        external_id: String(r.id),
        rating: r.rating != null ? Math.round(Number(r.rating)) : null,
        content: r.comment ?? null,
        author_name: r.nickname ?? null,
        written_at: r.created_at ?? null,
      }),
    );
  }

  /** 땡겨요 requestQueryReviewList 결과를 DB에 upsert */
  async upsertDdangyoReviews(
    storeId: string,
    userId: string,
    items: Array<{
      rview_atcl_no: string;
      rview_cont?: string | null;
      psnl_msk_nm?: string | null;
      reg_dttm?: string | null;
      good_eval_cd?: string | null;
    }>,
  ): Promise<{ upserted: number }> {
    return this.upsertPlatformReviews(
      storeId,
      "ddangyo",
      userId,
      items,
      (r) => ({
        external_id: String(r.rview_atcl_no),
        rating: r.good_eval_cd === "1" ? 5 : r.good_eval_cd != null ? 3 : null,
        content: r.rview_cont ?? null,
        author_name: r.psnl_msk_nm ?? null,
        written_at: r.reg_dttm ?? null,
      }),
    );
  }

  private async insertOneMockReview(
    storeId: string,
    platform: string,
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
  const rawImages = row.images;
  const images: { imageUrl: string }[] = Array.isArray(rawImages)
    ? rawImages
        .filter((el): el is { imageUrl: string } => el != null && typeof el === "object" && typeof (el as { imageUrl?: unknown }).imageUrl === "string")
        .map((el) => ({ imageUrl: el.imageUrl }))
    : [];
  const rawMenus = row.menus;
  const menus: string[] = Array.isArray(rawMenus)
    ? rawMenus.filter((m): m is string => typeof m === "string" && m.trim() !== "")
    : [];
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
    images: images.length > 0 ? images : undefined,
    menus: menus.length > 0 ? menus : undefined,
    platform_reply_content: row.platform_reply_content != null ? (row.platform_reply_content as string) : null,
  };
}
