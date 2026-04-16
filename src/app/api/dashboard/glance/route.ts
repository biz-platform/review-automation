import { NextRequest, NextResponse } from "next/server";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError, AppNotFoundError } from "@/lib/errors/app-error";
import type {
  DashboardGlanceAiInsightFallbackReason,
  DashboardGlanceAiInsightSource,
  DashboardGlanceData,
} from "@/entities/dashboard/types";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import { parseStoreFilterSegment } from "@/app/(protected)/manage/reviews/reviews-manage/store-filter-utils";
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
import { glanceCountDeltaPercent } from "@/lib/dashboard/glance-kpi-delta-percent";
import {
  fetchStorePlatformOrdersWatermarkAt,
  resolveDashboardGlanceAiSummaryWithCache,
} from "@/lib/dashboard/glance-ai-insight-cache";

const PLATFORMS = ["baemin", "coupang_eats", "yogiyo", "ddangyo"] as const;

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

/** 상단 KPI·AI 요약용: 땡겨요는 별점 체계가 아니므로 평균에서 제외 */
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
): Promise<NextResponse<AppRouteHandlerResponse<DashboardGlanceData>>> {
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);

  const { searchParams } = request.nextUrl;
  const storeIdRaw = (searchParams.get("storeId") ?? "").trim();
  const range = (searchParams.get("range") ?? "7d") as "7d" | "30d";
  const platformParam = (searchParams.get("platform") ?? "").trim();
  const debugAi = (searchParams.get("debugAi") ?? "").trim() === "1";

  const allStoresScope = storeIdRaw === "all";

  if (!storeIdRaw) {
    throw new AppBadRequestError({
      code: "STORE_ID_REQUIRED",
      message: "storeId가 필요합니다. (단일 매장 id 또는 all)",
    });
  }

  if (range !== "7d" && range !== "30d") {
    throw new AppBadRequestError({
      code: "INVALID_RANGE",
      message: "range는 7d 또는 30d 여야 합니다.",
    });
  }

  const platformFilter =
    platformParam &&
    PLATFORMS.includes(platformParam as (typeof PLATFORMS)[number])
      ? platformParam
      : null;

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
        if (
          !PLATFORMS.includes(parsed.platform as (typeof PLATFORMS)[number])
        ) {
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
      if (!PLATFORMS.includes(parsed.platform as (typeof PLATFORMS)[number])) {
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
      .eq("user_id", user.id);

    if (storesErr) throw storesErr;
    storeIdsForQuery = (storeRows ?? []).map((r) => r.id).filter(Boolean);
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
        .eq("user_id", user.id)
        .in("id", want);
      if (storeErr) throw storeErr;
      const ok = new Set((storeRows ?? []).map((r) => r.id));
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
        .eq("user_id", user.id)
        .maybeSingle();

      if (storeErr) throw storeErr;
      if (!storeRow) {
        throw new AppNotFoundError({
          code: "STORE_NOT_FOUND",
          message: "매장을 찾을 수 없습니다.",
        });
      }
      storeIdsForQuery = [storeRow.id];
    }
  }

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

  const platformBreakdown: DashboardGlanceData["platformBreakdown"] = [];
  for (const p of PLATFORMS) {
    if (!platformConflict && platformEq && platformEq !== p) continue;
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

  // 플랫폼 필터가 ddangyo일 때: 전 기간 맛있어요%도 내려서 카드에서 비교 가능하게 함
  const ddangyoPrevTastyRatioPercent =
    platformEq === "ddangyo"
      ? ddangyoTastyRatioPercent(
          prevRows.filter((r) => r.platform === "ddangyo"),
        )
      : null;
  const ddangyoCurrTastyRatioPercent =
    platformEq === "ddangyo"
      ? (platformBreakdown[0]?.tastyRatioPercent ?? null)
      : null;
  const ddangyoTastyRatioPoints =
    ddangyoCurrTastyRatioPercent != null && ddangyoPrevTastyRatioPercent != null
      ? Math.round(
          (ddangyoCurrTastyRatioPercent - ddangyoPrevTastyRatioPercent) * 10,
        ) / 10
      : null;

  const deltas = {
    /** 직전 동일 기간 대비 리뷰 수 증감률(%) */
    reviewCount: glanceCountDeltaPercent(
      curr.totalReviews,
      prev.totalReviews,
    ),
    avgRating:
      curr.avgRating != null && prev.avgRating != null
        ? Math.round((curr.avgRating - prev.avgRating) * 10) / 10
        : null,
    replyRatePoints:
      curr.replyRatePercent != null && prev.replyRatePercent != null
        ? Math.round((curr.replyRatePercent - prev.replyRatePercent) * 10) / 10
        : null,
    /** 직전 동일 기간 대비 주문 수 증감률(%) */
    orderCount: glanceCountDeltaPercent(curr.orderCount, prev.orderCount),
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
          subjectUserId: user.id,
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
        // 캐시 경로는 상세 예외를 저장하지 않으므로 디버그는 null
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

  const result: DashboardGlanceData = {
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
