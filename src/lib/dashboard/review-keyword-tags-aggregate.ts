import type { DashboardReviewKeywordCategory } from "@/entities/dashboard/reviews-types";

export type ReviewKeywordTagRow = {
  keyword: string;
  sentiment: "positive" | "negative";
  review_id: string;
  category?: string | null;
};

export type KeywordTagEntry = {
  keyword: string;
  reviewCount: number;
  category: DashboardReviewKeywordCategory;
};

function normalizeCategory(raw: string | null | undefined): DashboardReviewKeywordCategory {
  const v = (raw ?? "").trim();
  if (
    v === "taste" ||
    v === "quantity_price" ||
    v === "packaging_delivery" ||
    v === "revisit_recommend" ||
    v === "context" ||
    v === "other"
  ) {
    return v;
  }
  return "other";
}

/**
 * 긍정: 동일 키워드를 가진 리뷰 수 ≥ 3
 * 부정: ≥ 1 (스펙: 사장님이 인지할 수 있도록)
 */
export function aggregateKeywordTags(rows: ReviewKeywordTagRow[]): {
  positive: KeywordTagEntry[];
  negative: KeywordTagEntry[];
} {
  const pos = new Map<
    string,
    { reviewIds: Set<string>; category: DashboardReviewKeywordCategory }
  >();
  const neg = new Map<
    string,
    { reviewIds: Set<string>; category: DashboardReviewKeywordCategory }
  >();

  for (const r of rows) {
    const map = r.sentiment === "positive" ? pos : neg;
    const kw = (r.keyword ?? "").trim();
    if (!kw) continue;
    const category = normalizeCategory(r.category);
    let entry = map.get(kw);
    if (!entry) {
      entry = { reviewIds: new Set(), category };
      map.set(kw, entry);
    }
    entry.reviewIds.add(r.review_id);
  }

  const positive = [...pos.entries()]
    .map(([keyword, entry]) => ({
      keyword,
      reviewCount: entry.reviewIds.size,
      category: entry.category,
    }))
    .filter((x) => x.reviewCount >= 3)
    .sort((a, b) => b.reviewCount - a.reviewCount);

  const negative = [...neg.entries()]
    .map(([keyword, entry]) => ({
      keyword,
      reviewCount: entry.reviewIds.size,
      category: entry.category,
    }))
    .filter((x) => x.reviewCount >= 1)
    .sort((a, b) => b.reviewCount - a.reviewCount);

  return { positive, negative };
}
