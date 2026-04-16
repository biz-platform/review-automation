export type ReviewKeywordTagRow = {
  keyword: string;
  sentiment: "positive" | "negative";
  review_id: string;
};

export type KeywordTagEntry = { keyword: string; reviewCount: number };

/**
 * 긍정: 동일 키워드를 가진 리뷰 수 ≥ 3
 * 부정: ≥ 1 (스펙: 사장님이 인지할 수 있도록)
 */
export function aggregateKeywordTags(rows: ReviewKeywordTagRow[]): {
  positive: KeywordTagEntry[];
  negative: KeywordTagEntry[];
} {
  const pos = new Map<string, Set<string>>();
  const neg = new Map<string, Set<string>>();

  for (const r of rows) {
    const map = r.sentiment === "positive" ? pos : neg;
    let set = map.get(r.keyword);
    if (!set) {
      set = new Set();
      map.set(r.keyword, set);
    }
    set.add(r.review_id);
  }

  const positive = [...pos.entries()]
    .map(([keyword, set]) => ({ keyword, reviewCount: set.size }))
    .filter((x) => x.reviewCount >= 3)
    .sort((a, b) => b.reviewCount - a.reviewCount);

  const negative = [...neg.entries()]
    .map(([keyword, set]) => ({ keyword, reviewCount: set.size }))
    .filter((x) => x.reviewCount >= 1)
    .sort((a, b) => b.reviewCount - a.reviewCount);

  return { positive, negative };
}
