const API_BASE = "/api";

export const API_ENDPOINT = {
  health: `${API_BASE}/health`,
  stores: {
    list: `${API_BASE}/stores`,
    one: (id: string) => `${API_BASE}/stores/${id}`,
    toneSettings: (id: string) => `${API_BASE}/stores/${id}/tone-settings`,
    collect: (id: string) => `${API_BASE}/stores/${id}/collect`,
    baeminReviewsCount: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/baemin/reviews/count`,
    baeminReviews: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/baemin/reviews`,
    baeminReviewsSummary: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/baemin/reviews/summary`,
    baeminReviewsSync: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/baemin/reviews/sync`,
  },
  reviews: {
    list: `${API_BASE}/reviews`,
    one: (id: string) => `${API_BASE}/reviews/${id}`,
    collect: (id: string) => `${API_BASE}/reviews/${id}/collect`,
    replyDraft: (id: string) => `${API_BASE}/reviews/${id}/reply/draft`,
    replyApprove: (id: string) => `${API_BASE}/reviews/${id}/reply/approve`,
  },
} as const;
