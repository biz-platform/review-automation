import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardReviewAnalysisData } from "@/entities/dashboard/reviews-types";
import { fetchDashboardReviewsInScope } from "@/lib/dashboard/fetch-dashboard-reviews-in-scope";
import { aggregateKeywordTags } from "@/lib/dashboard/review-keyword-tags-aggregate";
import {
  avgRatingStarPlatforms,
  buildReviewTrendBuckets,
  buildStarDistribution,
} from "@/lib/dashboard/review-analysis-compute";
import { resolveDashboardStoreScope } from "@/lib/dashboard/resolve-dashboard-store-scope";
import { buildReviewAnalysisAiSummary } from "@/lib/dashboard/review-analysis-ai-summary";
import { getDashboardReviewPeriodBounds } from "@/lib/dashboard/dashboard-review-period";

export async function buildDashboardReviewAnalysisData(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    storeIdRaw: string;
    platformParam: string;
    range: "7d" | "30d";
  },
): Promise<DashboardReviewAnalysisData> {
  const scope = await resolveDashboardStoreScope(supabase, {
    ownerUserId: args.ownerUserId,
    storeIdRaw: args.storeIdRaw,
    platformParam: args.platformParam,
  });

  const bounds = getDashboardReviewPeriodBounds(args.range);
  const { currentStartYmd, currentEndYmd } = bounds;

  const { rows, keywordRows: kwRows } = await fetchDashboardReviewsInScope(
    supabase,
    {
      storeIdsForQuery: scope.storeIdsForQuery,
      multiSegments: scope.multiSegments,
      platformEq: scope.platformEq,
      shopEq: scope.shopEq,
      platformConflict: scope.platformConflict,
      fetchStartIso: bounds.fetchStartIso,
      fetchEndIso: bounds.fetchEndIso,
    },
  );

  const totalReviews = rows.length;
  const avgRating = avgRatingStarPlatforms(rows);
  const starDistribution = buildStarDistribution(rows);
  const trend = buildReviewTrendBuckets(
    rows,
    args.range,
    currentStartYmd,
    currentEndYmd,
  );

  const keywords = aggregateKeywordTags(kwRows);

  const aiSummary = buildReviewAnalysisAiSummary({
    totalReviews,
    trend,
    starDistribution,
    keywords,
  });

  const periodLabel = bounds.periodLabel;
  const nowKst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const hh = String(nowKst.getHours()).padStart(2, "0");
  const mm = String(nowKst.getMinutes()).padStart(2, "0");
  const asOfLabel = `${periodLabel} ${hh}:${mm} 기준`;

  return {
    range: args.range,
    periodLabel,
    asOfLabel,
    aiSummary,
    totalReviews,
    avgRating,
    starDistribution,
    trend,
    trendMode: args.range === "7d" ? "day" : "week",
    keywords,
  };
}
