import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardMultiSegment } from "@/lib/dashboard/resolve-dashboard-store-scope";
import { tryResolveCanonicalKeywordMatchList } from "@/lib/dashboard/review-keyword-dictionary";

const ID_CHUNK = 80;
const MAX_KEYWORD_REVIEW_IDS = 3000;
const OUTPUT_CAP = 200;
/** PostgREST GET URL 한도·in() 길이 회피: 매장 UUID 많을 때 store_id in 을 쪼갬 */
const STORE_ID_IN_CHUNK = 32;
/**
 * `keyword=in.(a,b)` 는 값 안의 쉼표를 구분자로 오인 → 400 Bad Request.
 * alias에 "비빔국수, 쫄볶이" 같은 문구가 있으면 반드시 eq + 따옴표로만 조합할 것.
 */
const KEYWORD_MATCH_OR_CHUNK = 12;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** PostgREST filter: keyword.eq."..." (내부 " 는 "") */
function postgrestDoubleQuotedValue(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

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
  const page = 1000;
  let keywordRowsScanned = 0;

  kwBatchLoop: for (const kwBatch of chunkArray(
    keywordsToMatch,
    KEYWORD_MATCH_OR_CHUNK,
  )) {
    let from = 0;
    for (;;) {
      let q = supabase
        .from("review_keywords")
        .select("review_id")
        .eq("sentiment", args.sentiment);
      if (kwBatch.length === 1) {
        q = q.eq("keyword", kwBatch[0]!);
      } else {
        q = q.or(
          kwBatch
            .map((k) => `keyword.eq.${postgrestDoubleQuotedValue(k)}`)
            .join(","),
        );
      }
      const { data, error } = await q
        .order("id", { ascending: true })
        .range(from, from + page - 1);
      if (error) throw error;
      const batch = data ?? [];
      for (const r of batch) {
        idRows.push({ review_id: (r as { review_id: string }).review_id });
      }
      keywordRowsScanned += batch.length;
      if (keywordRowsScanned >= MAX_KEYWORD_REVIEW_IDS) break kwBatchLoop;
      if (batch.length < page) break;
      from += page;
    }
  }

  const uniqueIds = [...new Set(idRows.map((r) => r.review_id))];
  if (uniqueIds.length === 0) return [];

  const merged: DashboardKeywordReviewRow[] = [];
  const storeChunks =
    args.multiSegments != null
      ? null
      : args.storeIdsForQuery.length <= STORE_ID_IN_CHUNK
        ? [args.storeIdsForQuery]
        : chunkArray(args.storeIdsForQuery, STORE_ID_IN_CHUNK);

  for (let i = 0; i < uniqueIds.length; i += ID_CHUNK) {
    const chunk = uniqueIds.slice(i, i + ID_CHUNK);

    if (args.multiSegments != null) {
      let q = supabase
        .from("reviews")
        .select("id, written_at, platform, rating, content, author_name")
        .in("id", chunk)
        .gte("written_at", args.fetchStartIso)
        .lte("written_at", args.fetchEndIso);
      const orParts = args.multiSegments.map((s) => {
        const base = [`store_id.eq.${s.storeId}`, `platform.eq.${s.platform}`];
        if (s.platformShopExternalId) {
          base.push(`platform_shop_external_id.eq.${s.platformShopExternalId}`);
        }
        return `and(${base.join(",")})`;
      });
      q = q.or(orParts.join(","));
      if (args.platformEq) q = q.eq("platform", args.platformEq);
      if (args.shopEq) q = q.eq("platform_shop_external_id", args.shopEq);
      const { data, error } = await q;
      if (error) throw error;
      for (const raw of data ?? []) merged.push(raw as DashboardKeywordReviewRow);
    } else {
      for (const storeIdIn of storeChunks!) {
        let q = supabase
          .from("reviews")
          .select("id, written_at, platform, rating, content, author_name")
          .in("id", chunk)
          .gte("written_at", args.fetchStartIso)
          .lte("written_at", args.fetchEndIso)
          .in("store_id", storeIdIn);
        if (args.platformEq) q = q.eq("platform", args.platformEq);
        if (args.shopEq) q = q.eq("platform_shop_external_id", args.shopEq);
        const { data, error } = await q;
        if (error) throw error;
        for (const raw of data ?? []) merged.push(raw as DashboardKeywordReviewRow);
      }
    }
  }

  merged.sort((a, b) => {
    const ta = a.written_at ? new Date(a.written_at).getTime() : 0;
    const tb = b.written_at ? new Date(b.written_at).getTime() : 0;
    return tb - ta;
  });

  return merged.slice(0, OUTPUT_CAP);
}
