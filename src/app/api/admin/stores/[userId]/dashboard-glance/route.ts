import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import {
  AppBadRequestError,
  AppForbiddenError,
  AppNotFoundError,
} from "@/lib/errors/app-error";
import type {
  AdminStoreDashboardGlanceData,
  AdminStorePlatform,
} from "@/entities/admin/types";
import { parseAdminDashboardRangeParam } from "@/entities/admin/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import type {
  DashboardGlanceAiInsightFallbackReason,
  DashboardGlanceAiInsightSource,
} from "@/entities/dashboard/types";
import { parseStoreFilterSegment } from "@/app/(protected)/manage/reviews/reviews-manage/store-filter-utils";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import { ddangyoTastyRatioPercent } from "@/lib/dashboard/glance-platform-metrics";
import {
  buildGlanceSeriesWithOrders,
  countOrdersInUtcWindow,
  countOrdersInWindowByPlatform,
  fetchGlanceStorePlatformOrders,
} from "@/lib/dashboard/glance-store-platform-orders";
import {
  buildGlanceAiSummary,
  buildGlanceInsightByRules,
} from "@/lib/dashboard/glance-ai-summary";
import {
  fetchStorePlatformOrdersWatermarkAt,
  resolveDashboardGlanceAiSummaryWithCache,
} from "@/lib/dashboard/glance-ai-insight-cache";

const PLATFORMS: AdminStorePlatform[] = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
];

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReviewRow = {
  written_at: string | null;
  rating: number | null;
  platform: string;
  platform_reply_content: string | null;
};

function avgRating(rows: { rating: number | null }[]): number | null {
  const nums = rows
    .map((r) => r.rating)
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function avgRatingStarPlatforms(rows: ReviewRow[]): number | null {
  return avgRating(rows.filter((r) => r.platform !== "ddangyo"));
}

function replyRate(rows: ReviewRow[]): number | null {
  if (rows.length === 0) return null;
  const answered = rows.filter((r) => r.platform_reply_content != null).length;
  return Math.round((answered / rows.length) * 1000) / 10;
}

async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<
  NextResponse<AppRouteHandlerResponse<AdminStoreDashboardGlanceData>>
> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const resolved = await (context?.params ?? Promise.resolve({}));
  const customerUserId = (resolved as { userId?: string }).userId;
  if (!customerUserId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const storeIdRaw = (searchParams.get("storeId") ?? "").trim();
  const range = parseAdminDashboardRangeParam(searchParams.get("range"));
  const platformParam = (searchParams.get("platform") ?? "").trim();
  const debugAi = (searchParams.get("debugAi") ?? "").trim() === "1";

  if (!storeIdRaw) {
    throw new AppBadRequestError({
      code: "STORE_ID_REQUIRED",
      message:
        "storeId가 필요합니다. (단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id))",
    });
  }

  const platformFilter =
    platformParam && PLATFORMS.includes(platformParam as AdminStorePlatform)
      ? platformParam
      : null;

  const allStoresScope = storeIdRaw === DASHBOARD_ALL_STORES_ID;

  let compositePlatform: string | null = null;
  let compositeShopExternalId: string | null = null;
  let resolvedStoreUuid: string | null = null;
  let multiSegments:
    | {
        storeId: string;
        platform: string;
        platformShopExternalId: string | null;
      }[]
    | null = null;

  if (!allStoresScope) {
    if (storeIdRaw.includes(",") && storeIdRaw.includes(":")) {
      const parts = storeIdRaw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      const parsedList = parts.map((p) => parseStoreFilterSegment(p));
      const segs: {
        storeId: string;
        platform: string;
        platformShopExternalId: string | null;
      }[] = [];
      for (const parsed of parsedList) {
        if (
          !parsed?.storeId?.trim() ||
          !STORE_UUID_RE.test(parsed.storeId.trim())
        ) {
          throw new AppBadRequestError({
            code: "INVALID_STORE_ID",
            message:
              "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
          });
        }
        if (!PLATFORMS.includes(parsed.platform as AdminStorePlatform)) {
          throw new AppBadRequestError({
            code: "INVALID_STORE_ID",
            message: "지원하지 않는 플랫폼입니다.",
          });
        }
        segs.push({
          storeId: parsed.storeId.trim(),
          platform: parsed.platform,
          platformShopExternalId: parsed.platformShopExternalId?.trim() || null,
        });
      }
      multiSegments = segs;
    } else if (storeIdRaw.includes(":")) {
      const parsed = parseStoreFilterSegment(storeIdRaw);
      if (
        !parsed?.storeId?.trim() ||
        !STORE_UUID_RE.test(parsed.storeId.trim())
      ) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      if (!PLATFORMS.includes(parsed.platform as AdminStorePlatform)) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message: "지원하지 않는 플랫폼입니다.",
        });
      }
      resolvedStoreUuid = parsed.storeId.trim();
      compositePlatform = parsed.platform;
      compositeShopExternalId = parsed.platformShopExternalId?.trim() || null;
    } else {
      if (!STORE_UUID_RE.test(storeIdRaw)) {
        throw new AppBadRequestError({
          code: "INVALID_STORE_ID",
          message:
            "storeId는 단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id) 형식이어야 합니다.",
        });
      }
      resolvedStoreUuid = storeIdRaw;
    }
  }

  let storeIdsForQuery: string[] = [];

  if (allStoresScope) {
    const { data: storeRows, error: storesErr } = await supabase
      .from("stores")
      .select("id")
      .eq("user_id", customerUserId);

    if (storesErr) throw storesErr;
    storeIdsForQuery = (storeRows ?? [])
      .map((r) => r.id as string)
      .filter(Boolean);
    if (storeIdsForQuery.length === 0) {
      throw new AppNotFoundError({
        code: "STORE_NOT_FOUND",
        message: "연동된 매장이 없습니다.",
      });
    }
  } else {
    if (multiSegments != null) {
      const want = [...new Set(multiSegments.map((s) => s.storeId))];
      const { data: storeRows, error: storeErr } = await supabase
        .from("stores")
        .select("id")
        .eq("user_id", customerUserId)
        .in("id", want);
      if (storeErr) throw storeErr;
      const ok = new Set((storeRows ?? []).map((r) => r.id as string));
      if (ok.size !== want.length) {
        throw new AppNotFoundError({
          code: "STORE_NOT_FOUND",
          message: "매장을 찾을 수 없습니다.",
        });
      }
      storeIdsForQuery = want;
    } else {
      const { data: storeRow, error: storeErr } = await supabase
        .from("stores")
        .select("id")
        .eq("id", resolvedStoreUuid!)
        .eq("user_id", customerUserId)
        .maybeSingle();

      if (storeErr) throw storeErr;
      if (!storeRow) {
        throw new AppNotFoundError({
          code: "STORE_NOT_FOUND",
          message: "매장을 찾을 수 없습니다.",
        });
      }
      storeIdsForQuery = [storeRow.id as string];
    }
  }

  const todayKst = formatKstYmd(new Date());
  const currentEndYmd = addCalendarDaysKst(todayKst, -1);
  const currentStartYmd =
    range === "7d"
      ? addCalendarDaysKst(currentEndYmd, -6)
      : addCalendarDaysKst(currentEndYmd, -29);

  const prevEndYmd = addCalendarDaysKst(currentStartYmd, -1);
  const prevStartYmd =
    range === "7d"
      ? addCalendarDaysKst(prevEndYmd, -6)
      : addCalendarDaysKst(prevEndYmd, -29);

  const fetchStart = kstYmdBoundsUtc(prevStartYmd, false);
  const fetchEnd = kstYmdBoundsUtc(currentEndYmd, true);

  let platformEq: string | null = compositePlatform;
  const shopEq: string | null = compositeShopExternalId;
  let platformConflict = false;

  if (platformFilter) {
    if (platformEq !== null && platformEq !== platformFilter) {
      platformConflict = true;
    } else {
      platformEq = platformFilter;
    }
  }

  let allRows: ReviewRow[] = [];

  if (!platformConflict) {
    let q = supabase
      .from("reviews")
      .select("written_at, rating, platform, platform_reply_content")
      .gte("written_at", fetchStart.toISOString())
      .lte("written_at", fetchEnd.toISOString());

    if (multiSegments != null) {
      const orParts = multiSegments.map((s) => {
        const base = [`store_id.eq.${s.storeId}`, `platform.eq.${s.platform}`];
        if (s.platformShopExternalId) {
          base.push(`platform_shop_external_id.eq.${s.platformShopExternalId}`);
        }
        return `and(${base.join(",")})`;
      });
      q = q.or(orParts.join(","));
    } else {
      q = q.in("store_id", storeIdsForQuery);
    }

    if (platformEq) q = q.eq("platform", platformEq);
    if (shopEq) q = q.eq("platform_shop_external_id", shopEq);

    const { data: rawRows, error: revErr } = await q;
    if (revErr) throw revErr;
    allRows = (rawRows ?? []) as ReviewRow[];
  }

  const currentStart = kstYmdBoundsUtc(currentStartYmd, false).getTime();
  const currentEnd = kstYmdBoundsUtc(currentEndYmd, true).getTime();
  const prevStart = kstYmdBoundsUtc(prevStartYmd, false).getTime();
  const prevEnd = kstYmdBoundsUtc(prevEndYmd, true).getTime();

  const inTime = (r: ReviewRow, a: number, b: number) => {
    if (!r.written_at) return false;
    const t = new Date(r.written_at).getTime();
    return t >= a && t <= b;
  };

  const currRows = allRows.filter((r) => inTime(r, currentStart, currentEnd));
  const prevRows = allRows.filter((r) => inTime(r, prevStart, prevEnd));

  const orderRows = await fetchGlanceStorePlatformOrders(supabase, {
    storeIdsForQuery,
    fetchStartIso: fetchStart.toISOString(),
    fetchEndIso: fetchEnd.toISOString(),
    multiSegments,
    platformEq,
    shopEq,
    platformConflict,
  });

  const currOrderCount = countOrdersInUtcWindow(
    orderRows,
    currentStart,
    currentEnd,
  );
  const prevOrderCount = countOrdersInUtcWindow(orderRows, prevStart, prevEnd);

  const curr = {
    totalReviews: currRows.length,
    avgRating: avgRatingStarPlatforms(currRows),
    replyRatePercent: replyRate(currRows),
    orderCount: currOrderCount,
  };
  const prev = {
    totalReviews: prevRows.length,
    avgRating: avgRatingStarPlatforms(prevRows),
    replyRatePercent: replyRate(prevRows),
    orderCount: prevOrderCount,
  };

  const series = buildGlanceSeriesWithOrders({
    reviewRowsInCurrent: currRows,
    orderRows,
    range,
    currentStartYmd,
    currentEndYmd,
  });

  const platformBreakdown: AdminStoreDashboardGlanceData["platformBreakdown"] =
    [];

  for (const p of PLATFORMS) {
    if (platformFilter && platformFilter !== p) continue;
    const pr = currRows.filter((r) => r.platform === p);
    const ord = countOrdersInWindowByPlatform(
      orderRows,
      currentStart,
      currentEnd,
      p,
    );

    if (p === "ddangyo") {
      platformBreakdown.push({
        platform: p,
        avgRating: null,
        tastyRatioPercent: ddangyoTastyRatioPercent(pr),
        reviewCount: pr.length,
        orderCount: ord,
      });
    } else {
      platformBreakdown.push({
        platform: p,
        avgRating: avgRating(pr),
        tastyRatioPercent: null,
        reviewCount: pr.length,
        orderCount: ord,
      });
    }
  }

  const ddangyoPrevTastyRatioPercent =
    platformFilter === "ddangyo"
      ? ddangyoTastyRatioPercent(
          prevRows.filter((r) => r.platform === "ddangyo"),
        )
      : null;
  const ddangyoCurrTastyRatioPercent =
    platformFilter === "ddangyo"
      ? (platformBreakdown[0]?.tastyRatioPercent ?? null)
      : null;
  const ddangyoTastyRatioPoints =
    ddangyoCurrTastyRatioPercent != null && ddangyoPrevTastyRatioPercent != null
      ? Math.round(
          (ddangyoCurrTastyRatioPercent - ddangyoPrevTastyRatioPercent) * 10,
        ) / 10
      : null;

  const deltas = {
    reviewCount: curr.totalReviews - prev.totalReviews,
    avgRating:
      curr.avgRating != null && prev.avgRating != null
        ? Math.round((curr.avgRating - prev.avgRating) * 10) / 10
        : null,
    replyRatePoints:
      curr.replyRatePercent != null && prev.replyRatePercent != null
        ? Math.round((curr.replyRatePercent - prev.replyRatePercent) * 10) / 10
        : null,
    orderCount: curr.orderCount - prev.orderCount,
  };

  let aiSummary: string;
  let aiInsightFromCache = false;
  let ordersDataWatermarkAt: string | null = null;
  let aiInsightSource: DashboardGlanceAiInsightSource = "rules";
  let aiInsightFallbackReason: DashboardGlanceAiInsightFallbackReason | null =
    null;
  let aiInsightDebug: Record<string, unknown> | null = null;
  // 현재 주문 수가 0이면(플랫폼 필터 적용 포함) 한눈 요약 AI 분석/저장/재사용을 하지 않음
  if (curr.orderCount === 0) {
    aiSummary = "주문 수 데이터가 없어 인사이트를 표시할 수 없어요.";
    aiInsightSource = "static";
    aiInsightFallbackReason = "skipped_no_orders";
  } else {
    try {
      // 디버그는 캐시 OFF: 매 요청마다 생성해 에러/검증 결과를 확인
      if (debugAi) {
        ordersDataWatermarkAt = await fetchStorePlatformOrdersWatermarkAt(
          supabase,
          storeIdsForQuery,
        );
        const built = await buildGlanceAiSummary({
          range,
          currentStartYmd,
          currentEndYmd,
          curr: {
            totalReviews: curr.totalReviews,
            avgRating: curr.avgRating,
            orderCount: curr.orderCount,
          },
          prev: {
            totalReviews: prev.totalReviews,
            avgRating: prev.avgRating,
            orderCount: prev.orderCount,
          },
          platformBreakdown,
        });
        aiSummary = built.text;
        aiInsightFromCache = false;
        aiInsightSource = built.source === "gemini" ? "gemini" : "rules";
        aiInsightFallbackReason = built.fallbackReason;
        aiInsightDebug =
          process.env.NODE_ENV !== "production" && debugAi
            ? (built.debug ?? null)
            : null;
      } else {
        const resolved = await resolveDashboardGlanceAiSummaryWithCache({
          supabase,
          subjectUserId: customerUserId,
          storeScopeKey: storeIdRaw,
          range,
          platformFilter,
          storeIdsForQuery,
          fingerprintPayload: {
            range,
            current: curr,
            previous: prev,
            deltas,
            platformBreakdown,
          },
          buildFreshSummary: async () =>
            buildGlanceAiSummary({
              range,
              currentStartYmd,
              currentEndYmd,
              curr: {
                totalReviews: curr.totalReviews,
                avgRating: curr.avgRating,
                orderCount: curr.orderCount,
              },
              prev: {
                totalReviews: prev.totalReviews,
                avgRating: prev.avgRating,
                orderCount: prev.orderCount,
              },
              platformBreakdown,
            }),
        });
        aiSummary = resolved.aiSummary;
        aiInsightFromCache = resolved.aiInsightFromCache;
        ordersDataWatermarkAt = resolved.ordersDataWatermarkAt;
        aiInsightSource = resolved.aiInsightSource;
        aiInsightFallbackReason = resolved.aiInsightFallbackReason;
        aiInsightDebug = null;
      }
    } catch {
      aiSummary =
        "AI 인사이트 생성에 실패했어요. (캐시/생성 로직을 확인해 주세요.)";
      aiInsightSource = "rules";
      aiInsightFallbackReason = "resolve_error";
      aiInsightDebug = null;
    }
  }

  const periodLabel = `${currentStartYmd.replace(/-/g, ".")} - ${currentEndYmd.replace(/-/g, ".")}`;
  const nowKst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const hh = String(nowKst.getHours()).padStart(2, "0");
  const mm = String(nowKst.getMinutes()).padStart(2, "0");
  const asOfLabel = `${periodLabel} ${hh}:${mm} 기준`;

  const result: AdminStoreDashboardGlanceData = {
    range,
    periodLabel,
    asOfLabel,
    current: curr,
    previous: prev,
    deltas,
    aiSummary,
    series,
    seriesMode: range === "7d" ? "day" : "week",
    platformBreakdown,
    meta: {
      ordersEstimated: false,
      aiInsightSource,
      aiInsightFallbackReason,
      aiInsightDebug,
      aiInsightFromCache,
      ordersDataWatermarkAt,
      ddangyoPrevTastyRatioPercent,
      ddangyoTastyRatioPoints,
    },
  };

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
