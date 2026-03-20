export type AdminCustomerFilterValue =
  | "all"
  | "center_manager"
  | "planner"
  | "paid_member"
  | "free_member";

export type AdminCustomerBillingState =
  | "exempt"
  | "active"
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

// ----- 매장 관리 -----

export type AdminStorePlatform = "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";

/** 고객별 매장 목록 한 행 (어드민 매장 관리) */
export type AdminStoreSummaryRow = {
  userId: string;
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
