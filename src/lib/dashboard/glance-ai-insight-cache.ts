import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardGlanceAiInsightFallbackReason,
  DashboardGlanceAiInsightSource,
} from "@/entities/dashboard/types";

export type DashboardAiInsightTab = "glance" | "sales" | "menu";

export type DashboardAiInsightFreshBuild = {
  text: string;
  source: "rules" | "gemini";
  fallbackReason?: DashboardGlanceAiInsightFallbackReason | null;
};

export type DashboardAiInsightResolveResult = {
  aiSummary: string;
  aiInsightFromCache: boolean;
  ordersDataWatermarkAt: string | null;
  aiInsightSource: DashboardGlanceAiInsightSource;
  aiInsightFallbackReason: DashboardGlanceAiInsightFallbackReason | null;
};

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
    /** 프롬프트·규칙 문구·KPI 델타 의미(건수→% 등) 바뀌면 올려 캐시 무효화 */
    glanceInsightTextFormat: 8,
    range: payload.range,
    current: payload.current,
    previous: payload.previous,
    /** `deltas`는 current/previous에서 유도되므로 핑거프린트에 넣지 않음(중복·표기 변경 방지) */
    platformBreakdown: payload.platformBreakdown.map((p) => ({
      platform: p.platform,
      avgRating: p.avgRating,
      tastyRatioPercent: p.tastyRatioPercent,
      reviewCount: p.reviewCount,
      orderCount: p.orderCount,
    })),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
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

type ResolveAiInsightArgs = {
  supabase: SupabaseClient;
  subjectUserId: string;
  storeScopeKey: string;
  range: "7d" | "30d";
  platformFilter: string | null;
  storeIdsForQuery: string[];
  insightTab: DashboardAiInsightTab;
  metricsFingerprint: string;
  buildFreshSummary: () => Promise<DashboardAiInsightFreshBuild>;
};

export async function resolveDashboardAiInsightWithCache(
  args: ResolveAiInsightArgs,
): Promise<DashboardAiInsightResolveResult> {
  const fingerprint = args.metricsFingerprint;
  const ordersDataWatermarkAt = await fetchStorePlatformOrdersWatermarkAt(
    args.supabase,
    args.storeIdsForQuery,
  );

  const platformKey = args.platformFilter ?? "";

  const { data: row, error } = await args.supabase
    .from("dashboard_glance_ai_insights")
    .select(
      "insight_text, metrics_fingerprint, orders_watermark_at, insight_source",
    )
    .eq("subject_user_id", args.subjectUserId)
    .eq("store_scope_key", args.storeScopeKey)
    .eq("range", args.range)
    .eq("platform_filter", platformKey)
    .eq("insight_tab", args.insightTab)
    .maybeSingle();

  if (error) throw error;

  const cachedRow = row as {
    insight_text: string;
    metrics_fingerprint: string;
    orders_watermark_at: string | null;
    insight_source: string | null;
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
    const cachedSrc = cachedRow.insight_source;
    // fallback을 전혀 쓰지 않기 위해, 캐시 히트도 gemini만 허용
    if (cachedSrc === "gemini") {
      return {
        aiSummary: cachedRow.insight_text,
        aiInsightFromCache: true,
        ordersDataWatermarkAt,
        aiInsightSource: "gemini",
        aiInsightFallbackReason: null,
      };
    }
  }

  const built = await args.buildFreshSummary();
  const text = built.text;
  const insightSource = built.source;

  // fallback을 전혀 쓰지 않기 위해, gemini 성공만 저장/재사용
  if (insightSource === "gemini") {
    const { error: upErr } = await args.supabase
      .from("dashboard_glance_ai_insights")
      .upsert(
        {
          subject_user_id: args.subjectUserId,
          store_scope_key: args.storeScopeKey,
          range: args.range,
          platform_filter: platformKey,
          insight_tab: args.insightTab,
          metrics_fingerprint: fingerprint,
          orders_watermark_at: ordersDataWatermarkAt,
          insight_text: text,
          insight_source: insightSource,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict:
            "subject_user_id,store_scope_key,range,platform_filter,insight_tab",
        },
      );

    if (upErr) throw upErr;
  }

  const aiInsightSource: DashboardGlanceAiInsightSource =
    insightSource === "gemini" ? "gemini" : "rules";
  const aiInsightFallbackReason: DashboardGlanceAiInsightFallbackReason | null =
    insightSource === "gemini" ? null : (built.fallbackReason ?? null);

  return {
    aiSummary: text,
    aiInsightFromCache: false,
    ordersDataWatermarkAt,
    aiInsightSource,
    aiInsightFallbackReason,
  };
}

type ResolveGlanceArgs = {
  supabase: SupabaseClient;
  subjectUserId: string;
  storeScopeKey: string;
  range: "7d" | "30d";
  platformFilter: string | null;
  storeIdsForQuery: string[];
  fingerprintPayload: GlanceFingerprintPayload;
  buildFreshSummary: () => Promise<DashboardAiInsightFreshBuild>;
};

export async function resolveDashboardGlanceAiSummaryWithCache(
  args: ResolveGlanceArgs,
): Promise<DashboardAiInsightResolveResult> {
  const fingerprint = buildGlanceMetricsFingerprint(args.fingerprintPayload);
  return resolveDashboardAiInsightWithCache({
    supabase: args.supabase,
    subjectUserId: args.subjectUserId,
    storeScopeKey: args.storeScopeKey,
    range: args.range,
    platformFilter: args.platformFilter,
    storeIdsForQuery: args.storeIdsForQuery,
    insightTab: "glance",
    metricsFingerprint: fingerprint,
    buildFreshSummary: args.buildFreshSummary,
  });
}
