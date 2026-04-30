import type { SupabaseClient } from "@supabase/supabase-js";
import { addCalendarDaysKst, formatKstYmd, kstYmdBoundsUtc } from "@/lib/utils/kst-date";

type DailyRow = {
  kst_date: string;
  order_count: number | null;
  total_pay_amount: number | null;
  store_id: string;
  platform: string;
};

type OrderRow = {
  order_at: string;
  pay_amount: number | null;
};

export type WeeklyStoreReportData = {
  storeId: string;
  weekStartYmd: string;
  weekEndYmd: string;
  weekLabel: string;
  totalSalesAmount: number;
  previousWeekSalesAmount: number;
  salesDeltaPercent: number;
  weekdayBars: { day: string; amount: number }[];
  /** 매출 상위 2일 → 인기, 매출 최소 1일 → 여유 (동률 전부면 둘 다 빈 값) */
  weekdayPopularIndices: number[];
  weekdayChillIndex: number | null;
  timeSlotShares: {
    morningPercent: number;
    lunchPercent: number;
    dinnerPercent: number;
  };
  /** 시간별 막대 — 첫·마지막 주문 시각(KST) 사이 전 구간(매출 0인 시도 포함) */
  hourBars: { hour: string; amount: number }[];
  /** `hourBars` 배열 인덱스 — 연속 구간 중 매출 합이 최대인 시간대(기본 4칸) */
  hourHighlightIndices: number[];
  platformRows: {
    platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";
    orderCount: number;
    salesAmount: number;
  }[];
  topPlatformDailyOrderGap: number;
  /** `platformRows` 순서와 동일, 주문 건수 기준 비율(합 100) */
  platformOrderPercents: number[];
};

const PLATFORM_ORDER: WeeklyStoreReportData["platformRows"][number]["platform"][] = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
];

function toKstDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year")?.value ?? "0"),
    month: Number(parts.find((p) => p.type === "month")?.value ?? "0"),
    day: Number(parts.find((p) => p.type === "day")?.value ?? "0"),
  };
}

function buildWeekLabel(weekEndYmd: string): string {
  const endDate = new Date(`${weekEndYmd}T00:00:00+09:00`);
  const { month, day } = toKstDateParts(endDate);
  const weekOfMonth = Math.ceil(day / 7);
  return `${month}월 ${weekOfMonth}주 차 리포트`;
}

/**
 * Figma 비교 문구 — 직전 주(리포트 주 시작 전날 = 전주 종료일)의 월·주차 기준
 * (예: "5월 2주 차보다")
 */
export function formatPreviousWeekComparisonLabel(weekStartYmd: string): string {
  const prevWeekEndYmd = addCalendarDaysKst(weekStartYmd, -1);
  const endDate = new Date(`${prevWeekEndYmd}T12:00:00+09:00`);
  const { month, day } = toKstDateParts(endDate);
  const weekOfMonth = Math.ceil(day / 7);
  return `${month}월 ${weekOfMonth}주 차보다`;
}

/** 알림톡 템플릿 변수 `#{월}`, `#{주차}` — 리포트 기준 주의 종료일(KST)로 계산 */
export function weeklyReportAlimtalkVariablesFromWeekEnd(weekEndYmd: string): {
  월: string;
  주차: string;
} {
  const endDate = new Date(`${weekEndYmd}T12:00:00+09:00`);
  const { month, day } = toKstDateParts(endDate);
  const weekOfMonth = Math.ceil(day / 7);
  return { 월: String(month), 주차: String(weekOfMonth) };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** 주문 건수 비율 % 정수(최대 길이 `counts`), 합 100 */
function orderCountsToPercents100(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const exact = counts.map((c) => (c / total) * 100);
  const floor = exact.map((x) => Math.floor(x));
  const rem = 100 - floor.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, r: x - Math.floor(x) }))
    .sort((a, b) => b.r - a.r);
  const out = [...floor];
  for (let k = 0; k < rem; k++) {
    const idx = order[k]?.i ?? order[0]!.i;
    out[idx] += 1;
  }
  return out;
}

function computeWeekdayDemandBadges(
  bars: readonly { amount: number }[],
): { popularIndices: number[]; chillIndex: number | null } {
  if (bars.length !== 7) return { popularIndices: [], chillIndex: null };
  const indexed = bars.map((b, i) => ({ i, a: b.amount }));
  const maxA = Math.max(...indexed.map((x) => x.a));
  const minA = Math.min(...indexed.map((x) => x.a));
  if (maxA === minA) {
    return { popularIndices: [], chillIndex: null };
  }
  const byDesc = [...indexed].sort((a, b) => b.a - a.a || a.i - b.i);
  const popularIndices = [byDesc[0]!.i, byDesc[1]!.i];
  const byAsc = [...indexed].sort((a, b) => a.a - b.a || a.i - b.i);
  const chillIndex = byAsc[0]!.i;
  return { popularIndices, chillIndex };
}

/** 연속 `windowSize`개 시간대 중 매출 합이 가장 큰 구간의 인덱스들 */
function hourBarsPeakWindowIndices(
  hourBars: readonly { amount: number }[],
  windowSize = 4,
): number[] {
  const n = hourBars.length;
  if (n === 0) return [];
  const w = Math.min(windowSize, n);
  let bestSum = -1;
  let bestStart = 0;
  for (let start = 0; start <= n - w; start++) {
    let s = 0;
    for (let k = 0; k < w; k++) {
      s += hourBars[start + k]?.amount ?? 0;
    }
    if (s > bestSum) {
      bestSum = s;
      bestStart = start;
    }
  }
  if (bestSum <= 0) return [];
  return Array.from({ length: w }, (_, k) => bestStart + k);
}

function normalizeHourKst(orderAt: string): number | null {
  const d = new Date(orderAt);
  if (!Number.isFinite(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function sumSales(rows: readonly DailyRow[]): number {
  let sum = 0;
  for (const r of rows) sum += r.total_pay_amount ?? 0;
  return sum;
}

function sumOrders(rows: readonly DailyRow[]): number {
  let sum = 0;
  for (const r of rows) sum += r.order_count ?? 0;
  return sum;
}

export function previousWeekRangeFromNowKst(now: Date): {
  weekStartYmd: string;
  weekEndYmd: string;
  prevWeekStartYmd: string;
  prevWeekEndYmd: string;
} {
  const today = formatKstYmd(now);
  const todayDate = new Date(`${today}T00:00:00+09:00`);
  const weekdaySun0 = todayDate.getUTCDay();
  const mondayDelta = weekdaySun0 === 0 ? -6 : 1 - weekdaySun0;
  const thisWeekMonday = addCalendarDaysKst(today, mondayDelta);
  const weekStartYmd = addCalendarDaysKst(thisWeekMonday, -7);
  const weekEndYmd = addCalendarDaysKst(weekStartYmd, 6);
  const prevWeekStartYmd = addCalendarDaysKst(weekStartYmd, -7);
  const prevWeekEndYmd = addCalendarDaysKst(prevWeekStartYmd, 6);
  return { weekStartYmd, weekEndYmd, prevWeekStartYmd, prevWeekEndYmd };
}

export async function buildWeeklyStoreReportData(
  supabase: SupabaseClient,
  params: {
    storeId: string;
    weekStartYmd: string;
    weekEndYmd: string;
    prevWeekStartYmd: string;
    prevWeekEndYmd: string;
  },
): Promise<WeeklyStoreReportData> {
  const { storeId, weekStartYmd, weekEndYmd, prevWeekStartYmd, prevWeekEndYmd } = params;

  const { data: allDaily, error: dailyErr } = await supabase
    .from("store_platform_dashboard_daily")
    .select("kst_date, order_count, total_pay_amount, store_id, platform")
    .eq("store_id", storeId)
    .gte("kst_date", prevWeekStartYmd)
    .lte("kst_date", weekEndYmd);
  if (dailyErr) throw dailyErr;
  const dailyRows = (allDaily ?? []) as DailyRow[];

  const currentRows = dailyRows.filter((r) => r.kst_date >= weekStartYmd && r.kst_date <= weekEndYmd);
  const previousRows = dailyRows.filter(
    (r) => r.kst_date >= prevWeekStartYmd && r.kst_date <= prevWeekEndYmd,
  );

  const totalSalesAmount = sumSales(currentRows);
  const previousWeekSalesAmount = sumSales(previousRows);
  const salesDeltaPercent =
    previousWeekSalesAmount > 0
      ? round1(((totalSalesAmount - previousWeekSalesAmount) / previousWeekSalesAmount) * 100)
      : 0;

  const weekdayBars: WeeklyStoreReportData["weekdayBars"] = [];
  for (let i = 0; i < 7; i++) {
    const ymd = addCalendarDaysKst(weekStartYmd, i);
    const amount = sumSales(currentRows.filter((r) => r.kst_date === ymd));
    weekdayBars.push({ day: String(new Date(`${ymd}T00:00:00+09:00`).getDate()), amount });
  }

  const { popularIndices: weekdayPopularIndices, chillIndex: weekdayChillIndex } =
    computeWeekdayDemandBadges(weekdayBars);

  const weekStartUtc = kstYmdBoundsUtc(weekStartYmd, false).toISOString();
  const weekEndUtc = kstYmdBoundsUtc(weekEndYmd, true).toISOString();
  const { data: orders, error: orderErr } = await supabase
    .from("store_platform_orders")
    .select("order_at, pay_amount")
    .eq("store_id", storeId)
    .gte("order_at", weekStartUtc)
    .lte("order_at", weekEndUtc);
  if (orderErr) throw orderErr;
  const orderRows = (orders ?? []) as OrderRow[];

  /** KST 주문 건수 기준 시간대 비중 — 아침 6~10, 점심 11~14(2시), 저녁 17~20(5~8시) */
  const SLOT_MORNING_HOURS = { start: 6, end: 10 } as const;
  const SLOT_LUNCH_HOURS = { start: 11, end: 14 } as const;
  const SLOT_DINNER_HOURS = { start: 17, end: 20 } as const;

  const hourSales = Array.from({ length: 24 }, () => 0);
  const hourHadOrder = Array.from({ length: 24 }, () => false);
  let morning = 0;
  let lunch = 0;
  let dinner = 0;
  for (const row of orderRows) {
    const hour = normalizeHourKst(row.order_at);
    if (hour == null) continue;
    hourHadOrder[hour] = true;
    const amount = row.pay_amount ?? 0;
    hourSales[hour] += amount;
    if (hour >= SLOT_MORNING_HOURS.start && hour <= SLOT_MORNING_HOURS.end) morning += 1;
    else if (hour >= SLOT_LUNCH_HOURS.start && hour <= SLOT_LUNCH_HOURS.end) lunch += 1;
    else if (hour >= SLOT_DINNER_HOURS.start && hour <= SLOT_DINNER_HOURS.end) dinner += 1;
  }
  const totalOrders = Math.max(1, morning + lunch + dinner);
  const timeSlotShares = {
    morningPercent: round1((morning / totalOrders) * 100),
    lunchPercent: round1((lunch / totalOrders) * 100),
    dinnerPercent: round1((dinner / totalOrders) * 100),
  };

  const hoursWithSales: number[] = [];
  for (let h = 0; h < 24; h++) {
    if (hourHadOrder[h]) hoursWithSales.push(h);
  }
  const hourBars: WeeklyStoreReportData["hourBars"] = [];
  if (hoursWithSales.length > 0) {
    const minH = Math.min(...hoursWithSales);
    const maxH = Math.max(...hoursWithSales);
    for (let hour = minH; hour <= maxH; hour++) {
      hourBars.push({
        hour: String(hour),
        amount: Math.round(hourSales[hour]),
      });
    }
  }
  const hourHighlightIndices = hourBarsPeakWindowIndices(hourBars, 4);

  const platformRows = PLATFORM_ORDER.map((platform) => {
    const rows = currentRows.filter((r) => r.platform === platform);
    return {
      platform,
      orderCount: sumOrders(rows),
      salesAmount: sumSales(rows),
    };
  });

  const platformOrderPercents = orderCountsToPercents100(
    platformRows.map((r) => r.orderCount),
  );

  const top = [...platformRows].sort((a, b) => b.orderCount - a.orderCount);
  const topPlatformDailyOrderGap =
    top.length >= 2 ? Math.max(0, Math.round((top[0].orderCount - top[1].orderCount) / 7)) : 0;

  return {
    storeId,
    weekStartYmd,
    weekEndYmd,
    weekLabel: buildWeekLabel(weekEndYmd),
    totalSalesAmount,
    previousWeekSalesAmount,
    salesDeltaPercent,
    weekdayBars,
    weekdayPopularIndices,
    weekdayChillIndex,
    timeSlotShares,
    hourBars,
    hourHighlightIndices,
    platformRows,
    platformOrderPercents,
    topPlatformDailyOrderGap,
  };
}
