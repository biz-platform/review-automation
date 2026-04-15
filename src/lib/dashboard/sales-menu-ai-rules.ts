import type { DashboardSalesData } from "@/entities/dashboard/sales-types";

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function buildMenuInsightByRules(args: {
  range: "7d" | "30d";
  topMenus: DashboardSalesData["topMenus"];
}): string {
  const period = args.range === "7d" ? "최근 7일" : "한 달";
  const top = args.topMenus?.[0];
  if (!top) {
    return `${period} 기준 집계된 메뉴 매출 데이터가 아직 없어요.\n주문 데이터가 쌓이면 메뉴별 매출/비중을 기준으로 핵심 메뉴를 바로 짚어드릴게요.`;
  }
  const share =
    top.shareOfRevenuePercent != null
      ? `${top.shareOfRevenuePercent.toFixed(1)}%`
      : "—";
  return `${period} 기준으로 ${top.menuName}(이)가 전체 메뉴 매출 대비 ${share}로 1위예요.\n상위 메뉴 쏠림이 큰 편이라면 세트/사이드 묶기나 대체 메뉴 노출로 분산을 시도해봐도 좋아요.`;
}

export function buildSalesInsightByRules(args: {
  range: "7d" | "30d";
  current: DashboardSalesData["current"];
  previous: DashboardSalesData["previous"];
  deltas: DashboardSalesData["deltas"];
  weekdayHourSales: DashboardSalesData["weekdayHourSales"];
}): string {
  const { range, current, previous, deltas, weekdayHourSales } = args;
  const period = range === "7d" ? "최근 7일" : "한 달";

  const byWd = Array.from({ length: 7 }, (_, i) => ({
    weekday: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
    pay: 0,
    orders: 0,
  }));
  for (const r of weekdayHourSales) {
    byWd[r.weekday].pay += r.totalPayAmount;
    byWd[r.weekday].orders += r.orderCount;
  }
  const active = byWd.filter((x) => x.pay > 0);
  if (active.length === 0) {
    return `${period} 기준 시간대별 매출 데이터가 아직 충분하지 않아요.\n주문이 쌓이면 요일·시간대 패턴을 바로 요약해드릴게요.`;
  }
  const sorted = [...active].sort((a, b) => b.pay - a.pay);
  const best = sorted[0]!;
  const worst = sorted[sorted.length - 1]!;
  const bestLabel = WEEKDAY_KO[best.weekday];
  const worstLabel = WEEKDAY_KO[worst.weekday];

  const hoursForBest = weekdayHourSales.filter(
    (h) => h.weekday === best.weekday && h.totalPayAmount > 0,
  );
  let peakSuffix = "";
  if (hoursForBest.length > 0) {
    const peak = [...hoursForBest].sort(
      (a, b) => b.totalPayAmount - a.totalPayAmount,
    )[0]!;
    peakSuffix = `같은 날 ${peak.hour}시 전후에 매출이 특히 몰려 있어요.`;
  }

  const p1 = `${period} 기준으로 요일별로는 ${bestLabel}요일 매출이 가장 높고, ${worstLabel}요일이 상대적으로 여유로워 보여요.${peakSuffix ? ` ${peakSuffix}` : ""}`;

  let paySentence = "";
  if (previous.totalPayAmount > 0) {
    const payDeltaPct = (deltas.totalPayAmount / previous.totalPayAmount) * 100;
    const rounded = Math.round(payDeltaPct * 10) / 10;
    if (Math.abs(rounded) < 0.05) {
      paySentence = "지난 기간과 비슷한 수준의 매출 흐름이에요.";
    } else if (rounded > 0) {
      paySentence = `지난 대비 총 매출은 약 ${rounded}% 늘었어요.`;
    } else {
      paySentence = `지난 대비 총 매출은 약 ${Math.abs(rounded)}% 줄었어요.`;
    }
  } else if (current.totalPayAmount > 0) {
    paySentence = "지난 기간 대비 총 매출은 신규로 잡힌 구간이에요.";
  }

  let orderSentence = "";
  if (current.orderCount > 0 && previous.orderCount > 0) {
    const ocDeltaPct =
      ((current.orderCount - previous.orderCount) / previous.orderCount) * 100;
    const ocRounded = Math.round(ocDeltaPct * 10) / 10;
    if (Math.abs(ocRounded) >= 0.05) {
      orderSentence =
        ocRounded > 0
          ? `주문 건수는 약 ${ocRounded}% 늘었어요.`
          : `주문 건수는 약 ${Math.abs(ocRounded)}% 줄었어요.`;
    }
  }

  const p2 = [paySentence, orderSentence].filter(Boolean).join(" ");
  const p3 =
    "저매출 요일엔 준비/정비에 집중하고, 피크 요일엔 원활한 출고 동선을 맞춰두면 좋아요.";

  return [p1, ...(p2 ? [p2] : []), p3].join("\n");
}
