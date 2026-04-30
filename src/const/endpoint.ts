const API_BASE = "/api";

export const API_ENDPOINT = {
  health: `${API_BASE}/health`,
  me: `${API_BASE}/me`,
  meOnboarding: `${API_BASE}/me/onboarding`,
  meBilling: `${API_BASE}/me/billing`,
  meBillingPlanUpgrade: `${API_BASE}/me/billing/plan/upgrade`,
  meBillingPlanDowngrade: `${API_BASE}/me/billing/plan/downgrade`,
  meBillingPlanPendingCancel: `${API_BASE}/me/billing/plan/pending/cancel`,
  meSubscriptionCancelAtPeriodEnd: `${API_BASE}/me/subscription/cancel-at-period-end`,
  meSubscriptionResumeAtPeriodEnd: `${API_BASE}/me/subscription/resume-at-period-end`,
  auth: {
    availability: `${API_BASE}/auth/availability`,
    verificationCodes: `${API_BASE}/auth/verification-codes`,
    verificationCodesValidations: `${API_BASE}/auth/verification-codes/validations`,
    findIdVerify: `${API_BASE}/auth/find-id/verify`,
    findPasswordSendCode: `${API_BASE}/auth/find-password/send-code`,
    findPasswordVerifyOtp: `${API_BASE}/auth/find-password/verify-otp`,
    findPasswordReset: `${API_BASE}/auth/find-password/reset`,
    signup: `${API_BASE}/auth/signup`,
  },
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
    platformSession: (storeId: string, platform: string) =>
      `${API_BASE}/stores/${storeId}/platform-session?platform=${encodeURIComponent(platform)}`,
  },
  sellers: {
    apply: `${API_BASE}/sellers/apply`,
    marketingLink: `${API_BASE}/sellers/marketing-link`,
    customers: `${API_BASE}/sellers/customers`,
    settlement: `${API_BASE}/sellers/settlement`,
  },
  dashboard: {
    glance: `${API_BASE}/dashboard/glance`,
    sales: `${API_BASE}/dashboard/sales`,
    reviews: `${API_BASE}/dashboard/reviews`,
    reviewsByKeyword: `${API_BASE}/dashboard/reviews/by-keyword`,
  },
  admin: {
    customers: `${API_BASE}/admin/customers`,
    customer: (id: string) => `${API_BASE}/admin/customers/${id}`,
    customerReferral: (id: string) => `${API_BASE}/admin/customers/${id}/referral`,
    referralSellerSearch: `${API_BASE}/admin/customers/referral-seller-search`,
    customerSellerApply: (id: string) =>
      `${API_BASE}/admin/customers/${id}/seller-apply`,
    stores: `${API_BASE}/admin/stores`,
    storeDetail: (userId: string) => `${API_BASE}/admin/stores/${userId}`,
    storePlatformStores: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/platform-stores`,
    storeWorkLogs: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/work-logs`,
    storeUnlinkRetention: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/unlink-retention`,
    storeReviewDetail: (userId: string, reviewId: string) =>
      `${API_BASE}/admin/stores/${userId}/reviews/${reviewId}`,
    storeDashboardGlance: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/dashboard-glance`,
    storeDashboardSales: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/dashboard-sales`,
    storeDashboardReviews: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/dashboard-reviews`,
    storeDashboardReviewsByKeyword: (userId: string) =>
      `${API_BASE}/admin/stores/${userId}/dashboard-reviews/by-keyword`,
    realtimeJobs: `${API_BASE}/admin/jobs/realtime`,
    sellers: `${API_BASE}/admin/sellers`,
    seller: (userId: string) => `${API_BASE}/admin/sellers/${userId}`,
    sellerCustomers: (userId: string) =>
      `${API_BASE}/admin/sellers/${userId}/customers`,
    billingInvoices: `${API_BASE}/admin/billing-invoices`,
    billingInvoiceRefund: (invoiceId: string) =>
      `${API_BASE}/admin/billing-invoices/${invoiceId}/refund`,
    billingPendingStale: `${API_BASE}/admin/billing-pending-stale`,
  },
  reviews: {
    list: `${API_BASE}/reviews`,
    one: (id: string) => `${API_BASE}/reviews/${id}`,
    collect: (id: string) => `${API_BASE}/reviews/${id}/collect`,
    replyDraft: (id: string) => `${API_BASE}/reviews/${id}/reply/draft`,
    replyApprove: (id: string) => `${API_BASE}/reviews/${id}/reply/approve`,
    replyRegister: (id: string) => `${API_BASE}/reviews/${id}/reply/register`,
    /** PATCH 수정 / DELETE 삭제 (플랫폼 반영) */
    reply: (id: string) => `${API_BASE}/reviews/${id}/reply`,
  },
} as const;
