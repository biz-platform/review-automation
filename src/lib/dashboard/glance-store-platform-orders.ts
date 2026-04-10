import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDaysKst, kstYmdBoundsUtc } from "@/lib/utils/kst-date";

export type GlanceOrderRow = {
  order_at: string;
  platform: string;
  store_id: string;
  platform_shop_external_id: string;
};

export type GlanceOrderSegment = {
  storeId: string;
  platform: string;
  platformShopExternalId: string | null;
};

function rowMatchesSegments(
  row: GlanceOrderRow,
  segments: readonly GlanceOrderSegment[],
): boolean {
  for (const s of segments) {
    if (row.store_id !== s.storeId) continue;
    if (row.platform !== s.platform) continue;
    const want = s.platformShopExternalId?.trim();
    if (!want) return true;
    if (String(row.platform_shop_external_id) === want) return true;
  }
  return false;
}

/** PostgREST 기본 max_rows(보통 1000) — glance 기간 전량 집계를 위해 페이지 반복 */
const GLANCE_ORDERS_PAGE_SIZE = 1000;

/**
 * 대시보드 glance와 동일한 매장·플랫폼·점포 필터로 `store_platform_orders` 조회.
 * (다중 세그먼트는 UUID `or()` 회피를 위해 메모리 필터)
 *
 * 단일 요청 시 행 수 상한을 넘기면 초·중순 주문이 빠져 막대가 0으로 보일 수 있어
 * `order_at`·`id` 정렬 후 range 로 전부 가져온다.
 */
export async function fetchGlanceStorePlatformOrders(
  supabase: SupabaseClient,
  args: {
    storeIdsForQuery: string[];
    fetchStartIso: string;
    fetchEndIso: string;
    multiSegments: GlanceOrderSegment[] | null;
    platformEq: string | null;
    shopEq: string | null;
    platformConflict: boolean;
  },
): Promise<GlanceOrderRow[]> {
  if (args.platformConflict) return [];
  if (args.storeIdsForQuery.length === 0) return [];

  const mapRow = (r: Record<string, unknown>): GlanceOrderRow => ({
    order_at: r.order_at as string,
    platform: r.platform as string,
    store_id: r.store_id as string,
    platform_shop_external_id: String(
      (r.platform_shop_external_id as string | null | undefined) ?? "",
    ),
  });

  const rows: GlanceOrderRow[] = [];
  let from = 0;
  for (;;) {
    let q = supabase
      .from("store_platform_orders")
      .select("order_at, platform, store_id, platform_shop_external_id")
      .in("store_id", args.storeIdsForQuery)
      .gte("order_at", args.fetchStartIso)
      .lte("order_at", args.fetchEndIso)
      .order("order_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + GLANCE_ORDERS_PAGE_SIZE - 1);

    if (args.platformEq) q = q.eq("platform", args.platformEq);
    if (args.shopEq) q = q.eq("platform_shop_external_id", args.shopEq);

    const { data, error } = await q;
    if (error) throw error;

    const batch = data ?? [];
    for (const r of batch) {
      rows.push(mapRow(r as Record<string, unknown>));
    }
    if (batch.length < GLANCE_ORDERS_PAGE_SIZE) break;
    from += GLANCE_ORDERS_PAGE_SIZE;
  }

  let out = rows;
  if (args.multiSegments != null) {
    out = rows.filter((r) => rowMatchesSegments(r, args.multiSegments!));
  }
  return out;
}

export function countOrdersInUtcWindow(
  rows: readonly GlanceOrderRow[],
  startMs: number,
  endMs: number,
): number {
  let n = 0;
  for (const r of rows) {
    const t = new Date(r.order_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= startMs && t <= endMs) n += 1;
  }
  return n;
}

export function countOrdersInWindowByPlatform(
  rows: readonly GlanceOrderRow[],
  startMs: number,
  endMs: number,
  platform: string,
): number {
  let n = 0;
  for (const r of rows) {
    if (r.platform !== platform) continue;
    const t = new Date(r.order_at).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= startMs && t <= endMs) n += 1;
  }
  return n;
}

/** `YYYY-MM-DD` 달력 순서 비교 */
function ymdCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** 7일(또는 마지막 잔여일) 버킷 축 라벨 — 예: 26.03.11–26.03.17 */
function formatGlanceWeekBucketLabel(
  startYmd: string,
  endYmd: string,
): string {
  const fmt = (ymd: string) => ymd.slice(2).replace(/-/g, ".");
  if (startYmd === endYmd) return fmt(startYmd);
  return `${fmt(startYmd)}–${fmt(endYmd)}`;
}

/**
 * 현재 기간(`currentStartYmd`~`currentEndYmd`) 안에서만 집계.
 * - 7d: 일별 버킷 (주문·리뷰 각각 해당 일 00:00~23:59 KST, 서로 매칭 없음)
 * - 30d: 달력 7일 단위 연속 구간(마지막 구간은 7일 미만일 수 있음), 동일하게 독립 집계
 */
export function buildGlanceSeriesWithOrders(args: {
  reviewRowsInCurrent: readonly { written_at: string | null }[];
  orderRows: readonly GlanceOrderRow[];
  range: "7d" | "30d";
  currentStartYmd: string;
  currentEndYmd: string;
}): { label: string; reviewCount: number; orderCount: number }[] {
  const {
    reviewRowsInCurrent,
    orderRows,
    range,
    currentStartYmd,
    currentEndYmd,
  } = args;

  const inBucketReview = (
    ymdStart: string,
    ymdEnd: string,
  ): number => {
    const start = kstYmdBoundsUtc(ymdStart, false).getTime();
    const end = kstYmdBoundsUtc(ymdEnd, true).getTime();
    let n = 0;
    for (const r of reviewRowsInCurrent) {
      if (!r.written_at) continue;
      const t = new Date(r.written_at).getTime();
      if (t >= start && t <= end) n += 1;
    }
    return n;
  };

  const inBucketOrders = (ymdStart: string, ymdEnd: string): number => {
    const start = kstYmdBoundsUtc(ymdStart, false).getTime();
    const end = kstYmdBoundsUtc(ymdEnd, true).getTime();
    return countOrdersInUtcWindow(orderRows, start, end);
  };

  if (range === "7d") {
    const out: { label: string; reviewCount: number; orderCount: number }[] =
      [];
    for (let i = 0; i < 7; i++) {
      const ymd = addCalendarDaysKst(currentStartYmd, i);
      out.push({
        label: ymd.slice(2).replace(/-/g, "."),
        reviewCount: inBucketReview(ymd, ymd),
        orderCount: inBucketOrders(ymd, ymd),
      });
    }
    return out;
  }

  const out: { label: string; reviewCount: number; orderCount: number }[] = [];
  let weekStart = currentStartYmd;
  while (ymdCompare(weekStart, currentEndYmd) <= 0) {
    const weekEndBy7 = addCalendarDaysKst(weekStart, 6);
    const endYmd =
      ymdCompare(weekEndBy7, currentEndYmd) <= 0 ? weekEndBy7 : currentEndYmd;
    out.push({
      label: formatGlanceWeekBucketLabel(weekStart, endYmd),
      reviewCount: inBucketReview(weekStart, endYmd),
      orderCount: inBucketOrders(weekStart, endYmd),
    });
    if (ymdCompare(endYmd, currentEndYmd) >= 0) break;
    weekStart = addCalendarDaysKst(endYmd, 1);
  }
  return out;
}
