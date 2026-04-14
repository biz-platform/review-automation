import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import {
  AppBadRequestError,
  AppForbiddenError,
  AppNotFoundError,
} from "@/lib/errors/app-error";
import type {
  DashboardSalesData,
  DashboardSalesRange,
} from "@/entities/dashboard/sales-types";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import { parseStoreFilterSegment } from "@/app/(protected)/manage/reviews/reviews-manage/store-filter-utils";

const PLATFORMS = ["baemin", "coupang_eats", "yogiyo", "ddangyo"] as const;

const STORE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DailyRow = {
  kst_date: string;
  order_count: number | null;
  total_pay_amount: number | null;
  settlement_amount: number | null;
  store_id: string;
  platform: string;
  platform_shop_external_id: string;
};

type MenuRow = {
  menu_name: string;
  quantity: number | null;
  line_total: number | null;
  kst_date: string;
  store_id: string;
  platform: string;
  platform_shop_external_id: string;
};

type OrderRow = {
  order_at: string;
  pay_amount: number | null;
  store_id: string;
  platform: string;
  platform_shop_external_id: string;
};

function ymdCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function formatWeekBucketLabel(startYmd: string, endYmd: string): string {
  const fmt = (ymd: string) => ymd.slice(2).replace(/-/g, ".");
  if (startYmd === endYmd) return fmt(startYmd);
  return `${fmt(startYmd)}–${fmt(endYmd)}`;
}

function sumDaily(rows: readonly DailyRow[]): {
  orderCount: number;
  totalPayAmount: number;
  settlementAmount: number;
  avgOrderAmount: number | null;
} {
  let orderCount = 0;
  let totalPayAmount = 0;
  let settlementAmount = 0;
  for (const r of rows) {
    const o = r.order_count ?? 0;
    const pay = r.total_pay_amount ?? 0;
    const settle = r.settlement_amount ?? 0;
    if (Number.isFinite(o)) orderCount += o;
    if (Number.isFinite(pay)) totalPayAmount += pay;
    if (Number.isFinite(settle)) settlementAmount += settle;
  }
  const avgOrderAmount =
    orderCount > 0 ? Math.round(totalPayAmount / orderCount) : null;
  return { orderCount, totalPayAmount, settlementAmount, avgOrderAmount };
}

const ORDER_PAGE_SIZE = 1000;

function kstWeekdayFromShortEn(s: string): 0 | 1 | 2 | 3 | 4 | 5 | 6 | null {
  if (s === "Mon") return 0;
  if (s === "Tue") return 1;
  if (s === "Wed") return 2;
  if (s === "Thu") return 3;
  if (s === "Fri") return 4;
  if (s === "Sat") return 5;
  if (s === "Sun") return 6;
  return null;
}

const KST_DTF = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
  hour: "2-digit",
  hourCycle: "h23",
});

function getKstWeekdayHour(
  iso: string,
): { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; hour: number } | null {
  const parseLooseDate = (v: string) => {
    const d1 = new Date(v);
    if (Number.isFinite(d1.getTime())) return d1;
    const v2 = v.includes("T") ? v : v.replace(" ", "T");
    const d2 = new Date(v2);
    if (Number.isFinite(d2.getTime())) return d2;
    const hasTz =
      /([zZ]|[+-]\d{2}:?\d{2})$/.test(v2) ||
      /([zZ]|[+-]\d{2}:?\d{2})$/.test(v);
    if (!hasTz) {
      const d3 = new Date(`${v2}Z`);
      if (Number.isFinite(d3.getTime())) return d3;
    }
    return null;
  };

  const d = parseLooseDate(iso);
  if (!d) return null;
  if (!Number.isFinite(d.getTime())) return null;
  const parts = KST_DTF.formatToParts(d);
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hr = parts.find((p) => p.type === "hour")?.value ?? "";
  const weekday = kstWeekdayFromShortEn(wd);
  const hour = Number.parseInt(hr, 10);
  if (weekday == null) return null;
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return { weekday, hour };
}

async function fetchOrdersInUtcWindowPaged(
  supabase: ReturnType<typeof createServiceRoleClient>,
  args: {
    storeIdsForQuery: string[];
    startIso: string;
    endIso: string;
    platformEq: string | null;
    shopEq: string | null;
    multiSegments:
      | {
          storeId: string;
          platform: string;
          platformShopExternalId: string | null;
        }[]
      | null;
  },
): Promise<OrderRow[]> {
  if (args.storeIdsForQuery.length === 0) return [];
  const out: OrderRow[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("store_platform_orders")
      .select(
        "order_at, pay_amount, store_id, platform, platform_shop_external_id, id",
      )
      .in("store_id", args.storeIdsForQuery)
      .gte("order_at", args.startIso)
      .lte("order_at", args.endIso)
      .order("order_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + ORDER_PAGE_SIZE - 1);

    if (args.platformEq) q = q.eq("platform", args.platformEq);
    if (args.shopEq) q = q.eq("platform_shop_external_id", args.shopEq);

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as unknown as OrderRow[];
    out.push(...batch);
    if (batch.length < ORDER_PAGE_SIZE) break;
    from += ORDER_PAGE_SIZE;
  }

  if (args.multiSegments && !args.shopEq) {
    return out.filter((r) => {
      for (const s of args.multiSegments!) {
        if (r.store_id !== s.storeId) continue;
        if (r.platform !== s.platform) continue;
        const want = s.platformShopExternalId?.trim();
        if (!want) return true;
        if (String(r.platform_shop_external_id) === want) return true;
      }
      return false;
    });
  }
  return out;
}

function buildWeekdayHourSales(
  rows: readonly OrderRow[],
): DashboardSalesData["weekdayHourSales"] {
  const gridAmount: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );
  const gridCount: number[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => 0),
  );

  for (const r of rows) {
    const k = getKstWeekdayHour(r.order_at);
    if (!k) continue;
    gridCount[k.weekday][k.hour] += 1;
    const amt = r.pay_amount ?? 0;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    gridAmount[k.weekday][k.hour] += amt;
  }

  const out: DashboardSalesData["weekdayHourSales"] = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (let hour = 0; hour < 24; hour++) {
      out.push({
        weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        hour,
        orderCount: gridCount[weekday][hour],
        totalPayAmount: Math.round(gridAmount[weekday][hour]),
      });
    }
  }
  return out;
}

function buildSeries(args: {
  rowsInCurrent: readonly DailyRow[];
  range: DashboardSalesRange;
  currentStartYmd: string;
  currentEndYmd: string;
}): DashboardSalesData["series"] {
  const { rowsInCurrent, range, currentStartYmd, currentEndYmd } = args;
  const inBucket = (ymdStart: string, ymdEnd: string) => {
    const picked = rowsInCurrent.filter(
      (r) => r.kst_date >= ymdStart && r.kst_date <= ymdEnd,
    );
    const summed = sumDaily(picked);
    return {
      orderCount: summed.orderCount,
      totalPayAmount: summed.totalPayAmount,
      settlementAmount: summed.settlementAmount,
    };
  };

  if (range === "7d") {
    const out: DashboardSalesData["series"] = [];
    for (let i = 0; i < 7; i++) {
      const ymd = addCalendarDaysKst(currentStartYmd, i);
      const v = inBucket(ymd, ymd);
      out.push({
        label: ymd.slice(2).replace(/-/g, "."),
        ...v,
      });
    }
    return out;
  }

  const out: DashboardSalesData["series"] = [];
  let weekStart = currentStartYmd;
  while (ymdCompare(weekStart, currentEndYmd) <= 0) {
    const weekEndBy7 = addCalendarDaysKst(weekStart, 6);
    const endYmd =
      ymdCompare(weekEndBy7, currentEndYmd) <= 0 ? weekEndBy7 : currentEndYmd;
    const v = inBucket(weekStart, endYmd);
    out.push({
      label: formatWeekBucketLabel(weekStart, endYmd),
      ...v,
    });
    if (ymdCompare(endYmd, currentEndYmd) >= 0) break;
    weekStart = addCalendarDaysKst(endYmd, 1);
  }
  return out;
}

function aggregateTopMenus(rows: readonly MenuRow[]): DashboardSalesData["topMenus"] {
  const map = new Map<
    string,
    { menuName: string; quantity: number; lineTotal: number }
  >();
  for (const r of rows) {
    const name = String(r.menu_name ?? "").trim();
    if (!name) continue;
    const prev = map.get(name) ?? { menuName: name, quantity: 0, lineTotal: 0 };
    const qty = r.quantity ?? 0;
    const total = r.line_total ?? 0;
    map.set(name, {
      menuName: name,
      quantity: prev.quantity + (Number.isFinite(qty) ? qty : 0),
      lineTotal: prev.lineTotal + (Number.isFinite(total) ? total : 0),
    });
  }
  const list = [...map.values()].sort((a, b) => b.lineTotal - a.lineTotal);
  const top = list.slice(0, 8);
  const sumRevenue = top.reduce((acc, x) => acc + x.lineTotal, 0);
  return top.map((x) => ({
    menuName: x.menuName,
    quantity: x.quantity,
    lineTotal: x.lineTotal,
    shareOfRevenuePercent:
      sumRevenue > 0 ? Math.round((x.lineTotal / sumRevenue) * 1000) / 10 : null,
  }));
}

async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<DashboardSalesData>>> {
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
  const range = (searchParams.get("range") ?? "7d") as DashboardSalesRange;
  const platformParam = (searchParams.get("platform") ?? "").trim();

  const allStoresScope = storeIdRaw === "all";

  if (!storeIdRaw) {
    throw new AppBadRequestError({
      code: "STORE_ID_REQUIRED",
      message:
        "storeId가 필요합니다. (단일 매장 UUID, all, 또는 uuid:플랫폼(:점포외부id))",
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
        if (!parsed?.storeId?.trim() || !STORE_UUID_RE.test(parsed.storeId.trim())) {
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
        segs.push({
          storeId: parsed.storeId.trim(),
          platform: parsed.platform,
          platformShopExternalId: parsed.platformShopExternalId?.trim() || null,
        });
      }
      multiSegments = segs;
    } else if (storeIdRaw.includes(":")) {
      const parsed = parseStoreFilterSegment(storeIdRaw);
      if (!parsed?.storeId?.trim() || !STORE_UUID_RE.test(parsed.storeId.trim())) {
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
      .eq("user_id", customerUserId);

    if (storesErr) throw storesErr;
    storeIdsForQuery = (storeRows ?? []).map((r) => r.id as string).filter(Boolean);
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

  const fetchStartYmd = prevStartYmd;
  const fetchEndYmd = currentEndYmd;

  if (platformConflict) {
    const empty: DashboardSalesData = {
      range,
      periodLabel: `${currentStartYmd.replace(/-/g, ".")} - ${currentEndYmd.replace(/-/g, ".")}`,
      asOfLabel: `${currentStartYmd.replace(/-/g, ".")} - ${currentEndYmd.replace(/-/g, ".")} 기준`,
      current: { orderCount: 0, totalPayAmount: 0, settlementAmount: 0, avgOrderAmount: null },
      previous: { orderCount: 0, totalPayAmount: 0, settlementAmount: 0, avgOrderAmount: null },
      deltas: { orderCount: 0, totalPayAmount: 0, settlementAmount: 0, avgOrderAmount: null },
      series: [],
      seriesMode: range === "7d" ? "day" : "week",
      weekdayHourSales: [],
      topMenus: [],
    };
    return NextResponse.json({ result: empty });
  }

  let q = supabase
    .from("store_platform_dashboard_daily")
    .select(
      "kst_date, order_count, total_pay_amount, settlement_amount, store_id, platform, platform_shop_external_id",
    )
    .in("store_id", storeIdsForQuery)
    .gte("kst_date", fetchStartYmd)
    .lte("kst_date", fetchEndYmd);
  if (platformEq) q = q.eq("platform", platformEq);
  if (shopEq) q = q.eq("platform_shop_external_id", shopEq);

  const { data: rawDaily, error: dailyErr } = await q;
  if (dailyErr) throw dailyErr;
  let dailyRows = (rawDaily ?? []) as DailyRow[];

  if (multiSegments != null && !shopEq) {
    dailyRows = dailyRows.filter((r) => {
      for (const s of multiSegments!) {
        if (r.store_id !== s.storeId) continue;
        if (r.platform !== s.platform) continue;
        const want = s.platformShopExternalId?.trim();
        if (!want) return true;
        if (String(r.platform_shop_external_id) === want) return true;
      }
      return false;
    });
  }

  const currDaily = dailyRows.filter(
    (r) => r.kst_date >= currentStartYmd && r.kst_date <= currentEndYmd,
  );
  const prevDaily = dailyRows.filter(
    (r) => r.kst_date >= prevStartYmd && r.kst_date <= prevEndYmd,
  );

  const currAgg = sumDaily(currDaily);
  const prevAgg = sumDaily(prevDaily);

  const series = buildSeries({
    rowsInCurrent: currDaily,
    range,
    currentStartYmd,
    currentEndYmd,
  });

  const currentStartUtc = kstYmdBoundsUtc(currentStartYmd, false);
  const currentEndUtc = kstYmdBoundsUtc(currentEndYmd, true);
  const orderRows = await fetchOrdersInUtcWindowPaged(supabase, {
    storeIdsForQuery,
    startIso: currentStartUtc.toISOString(),
    endIso: currentEndUtc.toISOString(),
    platformEq,
    shopEq,
    multiSegments,
  });
  const weekdayHourSales = buildWeekdayHourSales(orderRows);

  let topMenus: DashboardSalesData["topMenus"] = [];
  {
    let mq = supabase
      .from("store_platform_dashboard_menu_daily")
      .select("menu_name, quantity, line_total, kst_date, store_id, platform, platform_shop_external_id")
      .in("store_id", storeIdsForQuery)
      .gte("kst_date", currentStartYmd)
      .lte("kst_date", currentEndYmd);
    if (platformEq) mq = mq.eq("platform", platformEq);
    if (shopEq) mq = mq.eq("platform_shop_external_id", shopEq);
    const { data: rawMenus, error: menuErr } = await mq;
    if (!menuErr) {
      let menuRows = (rawMenus ?? []) as MenuRow[];
      if (multiSegments != null && !shopEq) {
        menuRows = menuRows.filter((r) => {
          for (const s of multiSegments!) {
            if (r.store_id !== s.storeId) continue;
            if (r.platform !== s.platform) continue;
            const want = s.platformShopExternalId?.trim();
            if (!want) return true;
            if (String(r.platform_shop_external_id) === want) return true;
          }
          return false;
        });
      }
      topMenus = aggregateTopMenus(menuRows);
    }
  }

  const periodLabel = `${currentStartYmd.replace(/-/g, ".")} - ${currentEndYmd.replace(/-/g, ".")}`;
  const nowKst = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  );
  const hh = String(nowKst.getHours()).padStart(2, "0");
  const mm = String(nowKst.getMinutes()).padStart(2, "0");
  const asOfLabel = `${periodLabel} ${hh}:${mm} 기준`;

  const result: DashboardSalesData = {
    range,
    periodLabel,
    asOfLabel,
    current: currAgg,
    previous: prevAgg,
    deltas: {
      orderCount: currAgg.orderCount - prevAgg.orderCount,
      totalPayAmount: currAgg.totalPayAmount - prevAgg.totalPayAmount,
      settlementAmount: currAgg.settlementAmount - prevAgg.settlementAmount,
      avgOrderAmount:
        currAgg.avgOrderAmount != null && prevAgg.avgOrderAmount != null
          ? currAgg.avgOrderAmount - prevAgg.avgOrderAmount
          : null,
    },
    series,
    seriesMode: range === "7d" ? "day" : "week",
    weekdayHourSales,
    topMenus,
  };

  return NextResponse.json({ result });
}

export const GET = withRouteHandler(getHandler);

