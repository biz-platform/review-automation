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
    coupangEatsSession: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/coupang-eats/session`,
    coupangEatsLink: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/coupang-eats/link`,
    coupangEatsReviewsSync: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/coupang-eats/reviews/sync`,
    ddangyoSession: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/ddangyo/session`,
    ddangyoLink: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/ddangyo/link`,
    ddangyoReviewsSync: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/ddangyo/reviews/sync`,
    yogiyoSession: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/yogiyo/session`,
    yogiyoLink: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/yogiyo/link`,
    yogiyoReviewsSync: (id: string) =>
      `${API_BASE}/stores/${id}/platforms/yogiyo/reviews/sync`,
    jobCancel: (storeId: string, jobId: string) =>
      `${API_BASE}/stores/${storeId}/jobs/${jobId}/cancel`,
  },
  reviews: {
    list: `${API_BASE}/reviews`,
    one: (id: string) => `${API_BASE}/reviews/${id}`,
    collect: (id: string) => `${API_BASE}/reviews/${id}/collect`,
    replyDraft: (id: string) => `${API_BASE}/reviews/${id}/reply/draft`,
    replyApprove: (id: string) => `${API_BASE}/reviews/${id}/reply/approve`,
    replyRegister: (id: string) => `${API_BASE}/reviews/${id}/reply/register`,
  },
} as const;
