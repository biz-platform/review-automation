export const QUERY_KEY = {
  store: {
    root: ["store"] as const,
    list: ["store", "list"] as const,
    listLinked: (platform: string) => ["store", "list", "linked", platform] as const,
    detail: (id: string) => ["store", "detail", id] as const,
    toneSettings: (id: string) => ["store", "toneSettings", id] as const,
    baeminReviewCount: (storeId: string, from?: string, to?: string) =>
      ["store", "baeminReviewCount", storeId, from, to] as const,
    baeminReviewList: (
      storeId: string,
      params?: { from?: string; to?: string; offset?: number; limit?: number }
    ) => ["store", "baeminReviewList", storeId, params] as const,
    baeminReviewSummary: (
      storeId: string,
      params?: { from?: string; to?: string; offset?: number; limit?: number; fetchAll?: boolean }
    ) => ["store", "baeminReviewSummary", storeId, params] as const,
    baeminReviewSummaryInfinite: (
      storeId: string,
      params?: { from?: string; to?: string; limit?: number }
    ) => ["store", "baeminReviewSummaryInfinite", storeId, params] as const,
  },
  review: {
    root: ["review"] as const,
    list: (params: Record<string, unknown>) => ["review", "list", params] as const,
    detail: (id: string) => ["review", "detail", id] as const,
  },
  reply: {
    draft: (reviewId: string) => ["reply", "draft", reviewId] as const,
  },
} as const;

export function createQueryKey<T extends readonly unknown[]>(...key: T): T {
  return key;
}
