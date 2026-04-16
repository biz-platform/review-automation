import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardReviewKeywordReviewListData } from "@/entities/dashboard/reviews-types";
import { getDashboardReviewPeriodBounds } from "@/lib/dashboard/dashboard-review-period";
import { fetchDashboardReviewsByKeyword } from "@/lib/dashboard/fetch-dashboard-reviews-by-keyword";
import { resolveDashboardStoreScope } from "@/lib/dashboard/resolve-dashboard-store-scope";

export async function buildDashboardReviewKeywordListData(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    storeIdRaw: string;
    platformParam: string;
    range: "7d" | "30d";
    keyword: string;
    sentiment: "positive" | "negative";
  },
): Promise<DashboardReviewKeywordReviewListData> {
  const scope = await resolveDashboardStoreScope(supabase, {
    ownerUserId: args.ownerUserId,
    storeIdRaw: args.storeIdRaw,
    platformParam: args.platformParam,
  });

  const bounds = getDashboardReviewPeriodBounds(args.range);

  const reviews = await fetchDashboardReviewsByKeyword(supabase, {
    storeIdsForQuery: scope.storeIdsForQuery,
    multiSegments: scope.multiSegments,
    platformEq: scope.platformEq,
    shopEq: scope.shopEq,
    platformConflict: scope.platformConflict,
    fetchStartIso: bounds.fetchStartIso,
    fetchEndIso: bounds.fetchEndIso,
    keyword: args.keyword,
    sentiment: args.sentiment,
  });

  return {
    keyword: args.keyword.trim(),
    sentiment: args.sentiment,
    periodLabel: bounds.periodLabel,
    reviews,
    count: reviews.length,
  };
}
