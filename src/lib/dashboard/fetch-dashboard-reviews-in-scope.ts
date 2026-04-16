import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardMultiSegment } from "@/lib/dashboard/resolve-dashboard-store-scope";
import type { ReviewKeywordTagRow } from "@/lib/dashboard/review-keyword-tags-aggregate";

const PAGE = 1000;

export type DashboardReviewAnalysisRow = {
  id: string;
  written_at: string | null;
  rating: number | null;
  platform: string;
};

export type FetchDashboardReviewsInScopeResult = {
  rows: DashboardReviewAnalysisRow[];
  /** 리뷰 행에 embed — `.in(review_id, 수백 UUID)` GET URL 초과 방지 */
  keywordRows: ReviewKeywordTagRow[];
};

export async function fetchDashboardReviewsInScope(
  supabase: SupabaseClient,
  args: {
    storeIdsForQuery: string[];
    multiSegments: DashboardMultiSegment[] | null;
    platformEq: string | null;
    shopEq: string | null;
    platformConflict: boolean;
    fetchStartIso: string;
    fetchEndIso: string;
  },
): Promise<FetchDashboardReviewsInScopeResult> {
  if (args.platformConflict) return { rows: [], keywordRows: [] };
  if (args.storeIdsForQuery.length === 0)
    return { rows: [], keywordRows: [] };

  const out: DashboardReviewAnalysisRow[] = [];
  const keywordRows: ReviewKeywordTagRow[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("reviews")
      .select(
        "id, written_at, rating, platform, platform_shop_external_id, review_keywords(keyword, sentiment)",
      )
      .gte("written_at", args.fetchStartIso)
      .lte("written_at", args.fetchEndIso);

    if (args.multiSegments != null) {
      const orParts = args.multiSegments.map((s) => {
        const base = [`store_id.eq.${s.storeId}`, `platform.eq.${s.platform}`];
        if (s.platformShopExternalId) {
          base.push(`platform_shop_external_id.eq.${s.platformShopExternalId}`);
        }
        return `and(${base.join(",")})`;
      });
      q = q.or(orParts.join(","));
    } else {
      q = q.in("store_id", args.storeIdsForQuery);
    }

    if (args.platformEq) q = q.eq("platform", args.platformEq);
    if (args.shopEq) q = q.eq("platform_shop_external_id", args.shopEq);

    const { data, error } = await q.range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const raw of batch) {
      const r = raw as {
        id: string;
        written_at: string | null;
        rating: number | null;
        platform: string;
        review_keywords?:
          | { keyword: string; sentiment: string }[]
          | null;
      };
      out.push({
        id: r.id,
        written_at: r.written_at,
        rating: r.rating,
        platform: r.platform,
      });
      const kws = r.review_keywords;
      if (!Array.isArray(kws)) continue;
      for (const k of kws) {
        const sent = k.sentiment;
        if (sent !== "positive" && sent !== "negative") continue;
        const kw = (k.keyword ?? "").trim();
        if (!kw) continue;
        keywordRows.push({
          keyword: kw,
          sentiment: sent,
          review_id: r.id,
        });
      }
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return { rows: out, keywordRows };
}
