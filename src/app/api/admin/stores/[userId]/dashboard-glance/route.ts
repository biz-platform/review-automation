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

function buildAiSummary(args: {
  range: "7d" | "30d";
  curr: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
  };
  prev: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
  };
}): string {
  const { range, curr, prev } = args;
  const periodWord = range === "7d" ? "지난 7일" : "직전 기간";
  const dReviews = curr.totalReviews - prev.totalReviews;
  const dRating =
    curr.avgRating != null && prev.avgRating != null
      ? Math.round((curr.avgRating - prev.avgRating) * 10) / 10
      : null;
  const dReply =
    curr.replyRatePercent != null && prev.replyRatePercent != null
      ? Math.round((curr.replyRatePercent - prev.replyRatePercent) * 10) / 10
      : null;

  const replyHigh =
    curr.replyRatePercent != null && curr.replyRatePercent >= 99.5;
  const replyStable = dReply != null && Math.abs(dReply) < 0.05;

  if (
    dReviews > 0 &&
    (replyStable || replyHigh) &&
    dRating != null &&
    dRating > 0
  ) {
    return `리뷰가 ${dReviews}개 늘고 답글도 ${curr.replyRatePercent?.toFixed(0) ?? "-"}% 유지되면서 가게에 대한 신뢰가 더 높아지고 있어요.\n이 흐름 덕분에 평점도 ${dRating.toFixed(1)} 상승하며 긍정적인 반응이 계속 쌓이고 있는 상태예요.`;
  }

  const headParts: string[] = [];

  if (dReviews > 0) {
    headParts.push(`리뷰가 ${dReviews}개 늘고`);
  } else if (dReviews < 0) {
    headParts.push(`리뷰가 ${Math.abs(dReviews)}개 줄고`);
  } else {
    headParts.push("리뷰 수는 비슷하게 유지되고");
  }

  if (dReply != null) {
    if (Math.abs(dReply) < 0.05) {
      headParts.push(
        `답글 작성률도 ${curr.replyRatePercent?.toFixed(1) ?? "-"}% 수준을 유지하면서`,
      );
    } else if (dReply > 0) {
      headParts.push(`답글 작성률이 ${dReply.toFixed(1)}%p 개선되며`);
    } else {
      headParts.push(`답글 작성률이 ${Math.abs(dReply).toFixed(1)}%p 조정되며`);
    }
  } else if (curr.replyRatePercent != null) {
    headParts.push(`답글 작성률은 ${curr.replyRatePercent.toFixed(1)}%이며`);
  }

  headParts.push("가게에 대한 신뢰도를 가늠해 볼 수 있어요.");

  let tail: string;
  if (dRating != null && Math.abs(dRating) >= 0.05) {
    const up = dRating > 0;
    tail = `${periodWord} 대비 평균 평점이 ${Math.abs(dRating).toFixed(1)}점 ${up ? "상승" : "하락"}하며 ${up ? "긍정적인 반응이 이어지는" : "개선 여지가 보이는"} 상태예요.`;
  } else {
    tail = `평균 평점은 ${curr.avgRating != null ? `${curr.avgRating.toFixed(1)}점` : "—"}로 ${periodWord}과 비슷한 흐름이에요.`;
  }

  return `${headParts.join(" ")}\n${tail}`;
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
  const currentEndYmd = todayKst;
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

  const aiSummary = buildAiSummary({
    range,
    curr: {
      totalReviews: curr.totalReviews,
      avgRating: curr.avgRating,
      replyRatePercent: curr.replyRatePercent,
    },
    prev: {
      totalReviews: prev.totalReviews,
      avgRating: prev.avgRating,
      replyRatePercent: prev.replyRatePercent,
    },
  });

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
    deltas: {
      reviewCount: curr.totalReviews - prev.totalReviews,
      avgRating:
        curr.avgRating != null && prev.avgRating != null
          ? Math.round((curr.avgRating - prev.avgRating) * 10) / 10
          : null,
      replyRatePoints:
        curr.replyRatePercent != null && prev.replyRatePercent != null
          ? Math.round((curr.replyRatePercent - prev.replyRatePercent) * 10) /
            10
          : null,
      orderCount: curr.orderCount - prev.orderCount,
    },
    aiSummary,
    series,
    seriesMode: range === "7d" ? "day" : "week",
    platformBreakdown,
    meta: { ordersEstimated: false },
  };

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);
