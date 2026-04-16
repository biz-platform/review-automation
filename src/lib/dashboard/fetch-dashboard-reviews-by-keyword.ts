import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardMultiSegment } from "@/lib/dashboard/resolve-dashboard-store-scope";
import { tryResolveCanonicalKeywordMatchList } from "@/lib/dashboard/review-keyword-dictionary";

const ID_CHUNK = 80;
const MAX_KEYWORD_REVIEW_IDS = 3000;
const OUTPUT_CAP = 200;

export type DashboardKeywordReviewRow = {
  id: string;
  written_at: string | null;
  platform: string;
  rating: number | null;
  content: string | null;
  author_name: string | null;
};

/**
 * `review_keywords` 일치 + 대시보드와 동일 기간·매장 스코프의 리뷰 목록.
 */
export async function fetchDashboardReviewsByKeyword(
  supabase: SupabaseClient,
  args: {
    storeIdsForQuery: string[];
    multiSegments: DashboardMultiSegment[] | null;
    platformEq: string | null;
    shopEq: string | null;
    platformConflict: boolean;
    fetchStartIso: string;
    fetchEndIso: string;
    keyword: string;
    sentiment: "positive" | "negative";
  },
): Promise<DashboardKeywordReviewRow[]> {
  if (args.platformConflict) return [];
  if (args.storeIdsForQuery.length === 0) return [];

  const kw = args.keyword.trim();
  if (!kw) return [];

  const keywordsToMatch = await tryResolveCanonicalKeywordMatchList(supabase, {
    sentiment: args.sentiment,
    canonicalKeyword: kw,
  });
  if (keywordsToMatch.length === 0) return [];

  const idRows: { review_id: string }[] = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("review_keywords")
      .select("review_id")
      .in("keyword", keywordsToMatch)
      .eq("sentiment", args.sentiment)
      .range(from, from + page - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const r of batch) {
      idRows.push({ review_id: (r as { review_id: string }).review_id });
    }
    if (batch.length < page) break;
    from += page;
    if (from >= MAX_KEYWORD_REVIEW_IDS) break;
  }

  const uniqueIds = [...new Set(idRows.map((r) => r.review_id))];
  if (uniqueIds.length === 0) return [];

  const merged: DashboardKeywordReviewRow[] = [];

  for (let i = 0; i < uniqueIds.length; i += ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + ID_CHUNK);
    let q = supabase
      .from("reviews")
      .select("id, written_at, platform, rating, content, author_name")
      .in("id", chunk)
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

    const { data, error } = await q;
    if (error) throw error;
    for (const raw of data ?? []) {
      const r = raw as DashboardKeywordReviewRow;
      merged.push(r);
    }
  }

  merged.sort((a, b) => {
    const ta = a.written_at ? new Date(a.written_at).getTime() : 0;
    const tb = b.written_at ? new Date(b.written_at).getTime() : 0;
    return tb - ta;
  });

  return merged.slice(0, OUTPUT_CAP);
}
