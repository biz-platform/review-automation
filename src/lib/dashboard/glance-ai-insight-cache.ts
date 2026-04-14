import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type GlanceFingerprintPayload = {
  range: "7d" | "30d";
  current: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCount: number;
  };
  previous: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCount: number;
  };
  deltas: {
    reviewCount: number;
    avgRating: number | null;
    replyRatePoints: number | null;
    orderCount: number;
  };
  platformBreakdown: {
    platform: string;
    avgRating: number | null;
    tastyRatioPercent: number | null;
    reviewCount: number;
    orderCount: number;
  }[];
};

export function buildGlanceMetricsFingerprint(
  payload: GlanceFingerprintPayload,
): string {
  const normalized = {
    range: payload.range,
    current: payload.current,
    previous: payload.previous,
    deltas: payload.deltas,
    platformBreakdown: payload.platformBreakdown.map((p) => ({
      platform: p.platform,
      avgRating: p.avgRating,
      tastyRatioPercent: p.tastyRatioPercent,
      reviewCount: p.reviewCount,
      orderCount: p.orderCount,
    })),
  };
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

export async function fetchStorePlatformOrdersWatermarkAt(
  supabase: SupabaseClient,
  storeIds: string[],
): Promise<string | null> {
  if (storeIds.length === 0) return null;
  const { data, error } = await supabase
    .from("store_platform_orders")
    .select("updated_at")
    .in("store_id", storeIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const row = data as { updated_at: string } | null;
  return row?.updated_at ?? null;
}

type ResolveArgs = {
  supabase: SupabaseClient;
  subjectUserId: string;
  storeScopeKey: string;
  range: "7d" | "30d";
  platformFilter: string | null;
  storeIdsForQuery: string[];
  fingerprintPayload: GlanceFingerprintPayload;
  buildFreshSummary: () => Promise<{ text: string; source: "rules" | "gemini" }>;
};

export async function resolveDashboardGlanceAiSummaryWithCache(
  args: ResolveArgs,
): Promise<{
  aiSummary: string;
  aiInsightFromCache: boolean;
  ordersDataWatermarkAt: string | null;
}> {
  const fingerprint = buildGlanceMetricsFingerprint(args.fingerprintPayload);
  const ordersDataWatermarkAt = await fetchStorePlatformOrdersWatermarkAt(
    args.supabase,
    args.storeIdsForQuery,
  );

  const platformKey = args.platformFilter ?? "";

  const { data: row, error } = await args.supabase
    .from("dashboard_glance_ai_insights")
    .select("insight_text, metrics_fingerprint, orders_watermark_at")
    .eq("subject_user_id", args.subjectUserId)
    .eq("store_scope_key", args.storeScopeKey)
    .eq("range", args.range)
    .eq("platform_filter", platformKey)
    .maybeSingle();

  if (error) throw error;

  const cachedRow = row as {
    insight_text: string;
    metrics_fingerprint: string;
    orders_watermark_at: string | null;
  } | null;

  const watermarkMatch =
    (cachedRow?.orders_watermark_at ?? null) ===
    (ordersDataWatermarkAt ?? null);
  const fingerprintMatch = cachedRow?.metrics_fingerprint === fingerprint;

  if (
    cachedRow &&
    fingerprintMatch &&
    watermarkMatch &&
    cachedRow.insight_text
  ) {
    return {
      aiSummary: cachedRow.insight_text,
      aiInsightFromCache: true,
      ordersDataWatermarkAt,
    };
  }

  const built = await args.buildFreshSummary();
  const text = built.text;
  const insightSource = built.source;

  const { error: upErr } = await args.supabase
    .from("dashboard_glance_ai_insights")
    .upsert(
      {
        subject_user_id: args.subjectUserId,
        store_scope_key: args.storeScopeKey,
        range: args.range,
        platform_filter: platformKey,
        metrics_fingerprint: fingerprint,
        orders_watermark_at: ordersDataWatermarkAt,
        insight_text: text,
        insight_source: insightSource,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "subject_user_id,store_scope_key,range,platform_filter",
      },
    );

  if (upErr) throw upErr;

  return {
    aiSummary: text,
    aiInsightFromCache: false,
    ordersDataWatermarkAt,
  };
}
