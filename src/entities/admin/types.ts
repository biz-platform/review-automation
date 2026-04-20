import type {
  DashboardGlanceAiInsightFallbackReason,
  DashboardGlanceAiInsightSource,
} from "@/entities/dashboard/types";
import type { StoreWithSessionData } from "@/entities/store/types";

export type AdminCustomerFilterValue =
  | "all"
  | "center_manager"
  | "planner"
  | "paid_member"
  | "free_member";

export type AdminCustomerBillingState =
  | "exempt"
  | "active"
  | "trial"
  | "expired"
  | "unpaid";

export type AdminCustomerData = {
  id: string;
  email: string | null;
  phone: string | null;
  role: "member" | "center_manager" | "planner";
  is_seller: boolean;
  paid_at: string | null;
  paid_until: string | null;
  created_at: string;
  billing_state: AdminCustomerBillingState;
  /** 영업 링크 가입 시 부모 셀러(users.id) */
  referred_by_user_id: string | null;
  referred_by_email: string | null;
  referred_by_role: "center_manager" | "planner" | null;
};

/** 어드민 고객 셀러 연결 모달 — 검색 결과 행 */
export type AdminReferralSellerSearchRow = {
  id: string;
  email: string | null;
  role: "center_manager" | "planner";
  referral_code: string | null;
};

export type AdminReferralSellerSearchData = {
  list: AdminReferralSellerSearchRow[];
};

/** 회원 유형 드롭다운 값: 센터장 | 플래너 | 유료회원 | 무료회원 */
export type AdminCustomerMemberTypeOption =
  | "center_manager"
  | "planner"
  | "paid_member"
  | "free_member";

export type AdminCustomerListApiRequestData = {
  limit?: number;
  offset?: number;
  keyword?: string;
  memberType?: AdminCustomerFilterValue;
};

export type AdminCustomerListData = {
  list: AdminCustomerData[];
  count: number;
};

// ----- 결제 관리 (어드민) -----

export type AdminBillingInvoicePaymentStatus = "completed" | "error";

export type AdminBillingInvoiceRefundStatus =
  | "none"
  | "eligible"
  | "ineligible"
  | "pending"
  | "completed";

export type AdminBillingInvoiceRow = {
  id: string;
  invoiceCode: string;
  paidAt: string;
  payerEmail: string | null;
  payerPhone: string | null;
  payerRole: "member" | "center_manager" | "planner";
  planName: string;
  amountWon: number;
  usagePeriodStart: string;
  usagePeriodEnd: string;
  /** 가입 시 연동된 셀러(users.referral_code) */
  referrerCode: string | null;
  paymentStatus: AdminBillingInvoicePaymentStatus;
  /** 표시용(결제일 7일 경과 시 요건 미달로 간주) */
  refundStatus: AdminBillingInvoiceRefundStatus;
  refundSubtext: string | null;
};

export type AdminBillingInvoiceListApiRequestData = {
  limit?: number;
  offset?: number;
  memberType?: AdminCustomerFilterValue;
  keyword?: string;
  invoiceCode?: string;
  /** YYYY-MM */
  month?: string;
};

export type AdminBillingInvoiceListData = {
  list: AdminBillingInvoiceRow[];
  count: number;
};

export type PatchAdminBillingInvoiceRefundApiRequestData = {
  refundStatus: "eligible" | "pending" | "completed";
};

// ----- 매장 관리 -----

export type AdminStorePlatform =
  | "baemin"
  | "coupang_eats"
  | "yogiyo"
  | "ddangyo";

/** 어드민 대시보드: 고객별 플랫폼 연동 매장 목록 (일반 /api/stores?linked_platform 과 동형) */
export type AdminUserPlatformStoresData = {
  storesBaemin: StoreWithSessionData[];
  storesCoupangEats: StoreWithSessionData[];
  storesDdangyo: StoreWithSessionData[];
  storesYogiyo: StoreWithSessionData[];
};

/** 고객별 매장 목록 한 행 (어드민 매장 관리) */
export type AdminStoreSummaryRow = {
  userId: string;
  /** 목록 식별용: 전체 매장 중 store_platform_sessions.created_at 최소(최초 연동) 행의 store_name, 없으면 해당 stores.name */
  previewStoreName: string | null;
  email: string | null;
  registerMethod: string; // e.g. "자동 | 18시" or "수동"
  registeredReplyCount: number;
  baeminCount: number;
  coupangCount: number;
  yogiyoCount: number;
  ddangyoCount: number;
  hasError: boolean;
  errorCount: number;
};

export type AdminStoreListApiRequestData = {
  limit?: number;
  offset?: number;
  keyword?: string;
  dateFrom?: string; // ISO date
  dateTo?: string;
  registrationMethod?: "all" | "auto" | "direct";
  errorsOnly?: boolean;
};

export type AdminStoreListData = {
  list: AdminStoreSummaryRow[];
  count: number;
  totalErrorCount: number;
};

/** 매장 상세 - 매장 개별 정보 (플랫폼별 1행) */
export type AdminStoreSessionRow = {
  storeId: string;
  platform: AdminStorePlatform;
  storeName: string | null;
  businessRegistrationNumber: string | null;
  reviewCount: number;
  unregisteredCount: number;
  registeredCount: number;
  hasError: boolean;
};

/** 매장 상세 - 전체 요약 */
export type AdminStoreDetailSummary = {
  userId: string;
  email: string | null;
  registerMethod: string;
  registeredReplyCount: number;
  baeminCount: number;
  coupangCount: number;
  yogiyoCount: number;
  ddangyoCount: number;
  hasError: boolean;
  errorCount: number;
};

export type AdminStoreDetailData = {
  summary: AdminStoreDetailSummary;
  sessions: AdminStoreSessionRow[];
  /** stores.id → store_platform_shops에 1건 이상 있는 플랫폼만 (칩 비활성 기준) */
  storePlatformsWithShops: Record<string, AdminStorePlatform[]>;
};

/** 작업 로그 한 행 (browser_jobs 기반) */
export type AdminWorkLogRow = {
  id: string;
  type: string;
  category: "sync" | "register_reply" | "link" | "modify_delete" | "other";
  categoryLabel: string;
  status: "completed" | "failed" | "pending" | "processing" | "cancelled";
  message: string;
  storeId: string | null;
  platform: string | null;
  /** UI 표시용 플랫폼 이름 (배민, 쿠팡이츠, 요기요, 땡겨요) */
  platformLabel: string | null;
  /** 답글 등록/수정/삭제 시 클릭용 (메시지 내 77fdb96f... 클릭 시 상세 모달) */
  reviewId: string | null;
  createdAt: string;
};

export type AdminWorkLogListData = {
  list: AdminWorkLogRow[];
  count: number;
};

export type AdminWorkLogListApiRequestData = {
  storeId?: string;
  platform?: string; // baemin | coupang_eats | yogiyo | ddangyo
  dateFrom?: string;
  dateTo?: string;
  category?: string;
  status?: "all" | "completed" | "failed";
  limit?: number;
  offset?: number;
};

/** 어드민 실시간 작업 관리 한 행 */
export type AdminRealtimeJobRow = {
  id: string;
  type: string;
  status: "completed" | "failed" | "pending" | "processing" | "cancelled";
  platform: string | null;
  platformLabel: string | null;
  storeId: string | null;
  storeName: string | null;
  userEmail: string | null;
  phase: string | null;
  progressPercent: number | null;
  remainingMinutes: number | null;
  elapsedMinutes: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminRealtimeJobListData = {
  list: AdminRealtimeJobRow[];
  count: number;
};

/** 연동 해제 시 스냅샷된 리뷰(어드민·데이터 관리 전용) */
export type AdminUnlinkRetentionRow = {
  id: string;
  sourceReviewId: string;
  sourceKind: "active" | "archive";
  storeId: string;
  storeName: string | null;
  platform: string;
  externalId: string | null;
  rating: number | null;
  content: string | null;
  authorName: string | null;
  writtenAt: string | null;
  platformReplyContent: string | null;
  platformReplyId: string | null;
  unlinkedAt: string;
  retainUntil: string;
  replyDraftSnapshot: unknown | null;
  archivedAt: string | null;
};

export type AdminUnlinkRetentionListData = {
  list: AdminUnlinkRetentionRow[];
  count: number;
};

export type AdminUnlinkRetentionListApiRequestData = {
  storeId?: string;
  platform?: string;
  includeExpired?: boolean;
  limit?: number;
  offset?: number;
};

// ----- 셀러 관리 -----

/** 셀러 유형 필터: 전체 | 센터장 | 플래너 */
export type AdminSellerTypeFilter = "all" | "center_manager" | "planner";

export type AdminSellerRow = {
  id: string;
  /** 올리뷰(앱) 이메일 — 삭제 등 내부용 */
  email: string | null;
  /** SNS dbtalk_partners.name */
  dbtalkName: string | null;
  /** SNS dbtalk_partners.phone */
  dbtalkPhone: string | null;
  /** 올리뷰 users.referral_code (영업 링크 ?ref=) */
  referralCode: string | null;
  role: "center_manager" | "planner";
  createdAt: string;
  /** 결제 원장 미연동 시 0 */
  paymentCount: number;
  /** 결제/정산 연동 전까지 0 (원) */
  estimatedSettlementAmount: number;
  /** 하위 고객 중 가장 늦은 paid_at */
  lastOrderAt: string | null;
  /** referred_by_user_id = 본인 인 고객 수 */
  referralCustomerCount: number;
};

export type AdminSellerListApiRequestData = {
  limit?: number;
  offset?: number;
  keyword?: string;
  sellerType?: AdminSellerTypeFilter;
};

export type AdminSellerListData = {
  list: AdminSellerRow[];
  count: number;
};

export type AdminSellerCustomerRow = {
  id: string;
  email: string | null;
  phone: string | null;
  serviceJoinedAt: string;
  lastPaidAt: string | null;
  role: "member" | "center_manager" | "planner";
  paid_until: string | null;
  /** 결제 원장 미연동 시 0 */
  paymentCount: number;
  /** 정산 연동 전까지 0 (원) */
  estimatedSettlementAmount: number;
};

export type AdminSellerCustomerListData = {
  list: AdminSellerCustomerRow[];
  count: number;
};

// ----- 매장 대시보드 (한 눈에 요약) -----

export type AdminDashboardRange = "7d" | "30d";

/** 어드민 매장 대시보드 기본 기간 (쿼리 `range` 미지정 시) */
export const ADMIN_DASHBOARD_DEFAULT_RANGE: AdminDashboardRange = "30d";

/** `range` 쿼리: 허용 값만 통과, 빈 문자열·공백·그 외는 {@link ADMIN_DASHBOARD_DEFAULT_RANGE} */
export function parseAdminDashboardRangeParam(
  raw: string | null | undefined,
): AdminDashboardRange {
  const v = raw?.trim();
  if (v === "7d" || v === "30d") return v;
  return ADMIN_DASHBOARD_DEFAULT_RANGE;
}

export type AdminStoreDashboardGlanceData = {
  range: AdminDashboardRange;
  /** 예: 2026.03.01 - 2026.03.07 */
  periodLabel: string;
  /** 예: 2026.03.01 - 2026.03.07 14:00 기준 */
  asOfLabel: string;
  current: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCount: number;
  };
  previous: {
    totalReviews: number;
    avgRating: number | null;
    replyRatePercent: number | null;
    orderCount: number;
  };
  deltas: {
    /** 직전 동일 기간 대비 리뷰 수 증감률(%, 소수 첫째 자리) */
    reviewCount: number;
    avgRating: number | null;
    replyRatePoints: number | null;
    /** 직전 동일 기간 대비 주문 수 증감률(%, 소수 첫째 자리) */
    orderCount: number;
  };
  aiSummary: string;
  series: {
    label: string;
    reviewCount: number;
    orderCount: number;
  }[];
  seriesMode: "day" | "week";
  platformBreakdown: {
    platform: AdminStorePlatform;
    /** 별점 플랫폼만. 땡겨요 행은 null */
    avgRating: number | null;
    /** 땡겨요만: 맛있어요 비율 % */
    tastyRatioPercent: number | null;
    reviewCount: number;
    orderCount: number;
  }[];
  meta: {
    ordersEstimated: false;
    aiInsightSource?: DashboardGlanceAiInsightSource;
    aiInsightFallbackReason?: DashboardGlanceAiInsightFallbackReason | null;
    aiInsightDebug?: Record<string, unknown> | null;
    aiInsightFromCache?: boolean;
    ordersDataWatermarkAt?: string | null;
    ddangyoPrevTastyRatioPercent?: number | null;
    ddangyoTastyRatioPoints?: number | null;
  };
};

export type AdminStoreDashboardGlanceApiRequestData = {
  userId: string;
  storeId: string;
  range: AdminDashboardRange;
  platform?: string;
};
