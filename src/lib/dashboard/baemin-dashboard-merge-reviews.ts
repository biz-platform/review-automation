import { formatKstYmd } from "@/lib/utils/kst-date";
import type { BaeminDashboardDailyAggregate } from "@/lib/dashboard/baemin-dashboard-types";

/**
 * 동기화된 리뷰 행(배민·해당 점포)으로 KST 일 → 건수 맵.
 * `written_at` 이 없는 행은 제외.
 */
export function countBaeminReviewsByKstDay(
  entries: readonly {
    writtenAt: string | null;
    platformShopExternalId: string | null;
  }[],
  platformShopExternalId: string,
): Map<string, number> {
  const shop = String(platformShopExternalId).trim();
  const m = new Map<string, number>();
  for (const e of entries) {
    if (!e.writtenAt || String(e.platformShopExternalId ?? "").trim() !== shop) {
      continue;
    }
    const ymd = formatKstYmd(new Date(e.writtenAt));
    m.set(ymd, (m.get(ymd) ?? 0) + 1);
  }
  return m;
}

/** 일별 주문 집계에 리뷰 수·전환율(review/order) 부여 */
export function mergeBaeminReviewCountsIntoDaily(
  daily: BaeminDashboardDailyAggregate[],
  reviewCountByKst: ReadonlyMap<string, number>,
): BaeminDashboardDailyAggregate[] {
  return daily.map((d) => {
    const rc = reviewCountByKst.get(d.kstDate) ?? 0;
    const ratio =
      d.orderCount > 0 ? rc / d.orderCount : null;
    return {
      ...d,
      reviewCount: rc,
      reviewConversionRatio: ratio,
    };
  });
}
