import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  AdminStoreListApiRequestData,
  AdminStoreListData,
  AdminStoreDetailData,
  AdminUserPlatformStoresData,
  AdminWorkLogListApiRequestData,
  AdminWorkLogListData,
  AdminUnlinkRetentionListApiRequestData,
  AdminUnlinkRetentionListData,
  AdminRealtimeJobListData,
  AdminStoreDashboardGlanceData,
  AdminStoreDashboardGlanceApiRequestData,
} from "@/entities/admin/types";
import type {
  DashboardReviewAnalysisApiRequestData,
  DashboardReviewAnalysisData,
  DashboardReviewKeywordReviewListApiRequestData,
  DashboardReviewKeywordReviewListData,
} from "@/entities/dashboard/reviews-types";
import type {
  DashboardSalesApiRequestData,
  DashboardSalesData,
} from "@/entities/dashboard/sales-types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      title?: string;
      message?: string;
      code?: string;
    };
    const msg = err.detail ?? err.error ?? err.title ?? err.message ?? res.statusText;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code ?? (res.status === 403 ? "ADMIN_REQUIRED" : undefined);
    throw e;
  }
  return res.json();
}

/** 어드민: 특정 고객의 플랫폼별 연동 매장 (대시보드 셀렉트용) */
export const getAdminUserPlatformStores: AsyncApiRequestFn<
  AdminUserPlatformStoresData,
  { userId: string }
> = async ({ userId }) => {
  const data = await getJson<{ result: AdminUserPlatformStoresData }>(
    API_ENDPOINT.admin.storePlatformStores(userId),
  );
  return data.result;
};

/** 어드민 고객별 매장 목록 */
export const getAdminStores: AsyncApiRequestFn<
  AdminStoreListData,
  AdminStoreListApiRequestData
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  if (params?.keyword?.trim()) searchParams.set("keyword", params.keyword.trim());
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.registrationMethod && params.registrationMethod !== "all") {
    searchParams.set("registrationMethod", params.registrationMethod);
  }
  if (params?.errorsOnly) searchParams.set("errorsOnly", "true");
  const url = `${API_ENDPOINT.admin.stores}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminStoreListData }>(url);
  return data.result;
};

/** 어드민 매장 대시보드 — 한 눈에 요약 데이터 */
export const getAdminStoreDashboardGlance: AsyncApiRequestFn<
  AdminStoreDashboardGlanceData,
  AdminStoreDashboardGlanceApiRequestData
> = async ({ userId, storeId, range, platform }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.admin.storeDashboardGlance(userId)}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminStoreDashboardGlanceData }>(url);
  return data.result;
};

/** 어드민 매장 대시보드 — 매출 요약 */
export const getAdminStoreDashboardSales: AsyncApiRequestFn<
  DashboardSalesData,
  { userId: string } & DashboardSalesApiRequestData
> = async ({ userId, storeId, range, platform }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.admin.storeDashboardSales(userId)}?${searchParams.toString()}`;
  const data = await getJson<{ result: DashboardSalesData }>(url);
  return data.result;
};

/** 어드민 매장 대시보드 — 리뷰 분석 */
export const getAdminStoreDashboardReviews: AsyncApiRequestFn<
  DashboardReviewAnalysisData,
  { userId: string } & DashboardReviewAnalysisApiRequestData
> = async ({ userId, storeId, range, platform }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.admin.storeDashboardReviews(userId)}?${searchParams.toString()}`;
  const data = await getJson<{ result: DashboardReviewAnalysisData }>(url);
  return data.result;
};

/** 어드민 매장 대시보드 — 키워드별 리뷰 목록(모달) */
export const getAdminStoreDashboardReviewsByKeyword: AsyncApiRequestFn<
  DashboardReviewKeywordReviewListData,
  { userId: string } & DashboardReviewKeywordReviewListApiRequestData
> = async ({ userId, storeId, range, platform, keyword, sentiment }) => {
  const searchParams = new URLSearchParams();
  searchParams.set("storeId", storeId);
  searchParams.set("range", range);
  searchParams.set("keyword", keyword);
  searchParams.set("sentiment", sentiment);
  if (platform?.trim()) searchParams.set("platform", platform.trim());
  const url = `${API_ENDPOINT.admin.storeDashboardReviewsByKeyword(userId)}?${searchParams.toString()}`;
  const data = await getJson<{
    result: DashboardReviewKeywordReviewListData;
  }>(url);
  return data.result;
};

/** 어드민 매장 상세 (특정 고객의 매장 요약 + 플랫폼별 세션) */
export const getAdminStoreDetail: AsyncApiRequestFn<
  AdminStoreDetailData,
  { userId: string }
> = async ({ userId }) => {
  const data = await getJson<{ result: AdminStoreDetailData }>(
    API_ENDPOINT.admin.storeDetail(userId),
  );
  return data.result;
};

/** 어드민 매장 상세 - 작업 로그 목록 */
export const getAdminStoreWorkLogs: AsyncApiRequestFn<
  AdminWorkLogListData,
  { userId: string } & AdminWorkLogListApiRequestData
> = async ({ userId, ...params }) => {
  const searchParams = new URLSearchParams();
  if (params?.storeId) searchParams.set("storeId", params.storeId);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.status && params.status !== "all")
    searchParams.set("status", params.status);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  const url = `${API_ENDPOINT.admin.storeWorkLogs(userId)}?${searchParams.toString()}`;
  const data = await getJson<{ result: AdminWorkLogListData }>(url);
  return data.result;
};

export type AdminReviewDetailData = {
  /** 작업 로그의 reviewId(원본 reviews.id)와 맞추기 위해 스냅샷도 source_review_id 우선 */
  id: string;
  content: string | null;
  platform_reply_content: string | null;
  author_name: string | null;
  written_at: string | null;
  platform: string;
  rating: number | null;
  /** 주문 메뉴명 (배민 menus 등) */
  menus: string[];
  source?: "reviews" | "unlink_retention";
  /** 스냅샷만. ISO 문자열 */
  retainUntil?: string | null;
};

/** 어드민 매장 상세 - 리뷰 1건 (리뷰 내용 + 답글). 작업 로그 reviewId 클릭 시 */
export const getAdminStoreReviewDetail: AsyncApiRequestFn<
  AdminReviewDetailData,
  { userId: string; reviewId: string }
> = async ({ userId, reviewId }) => {
  const data = await getJson<{ result: AdminReviewDetailData }>(
    API_ENDPOINT.admin.storeReviewDetail(userId, reviewId),
  );
  return data.result;
};

/** 어드민: 연동 해제 리뷰 스냅샷 목록 */
export const getAdminStoreUnlinkRetention: AsyncApiRequestFn<
  AdminUnlinkRetentionListData,
  { userId: string } & AdminUnlinkRetentionListApiRequestData
> = async ({ userId, ...params }) => {
  const searchParams = new URLSearchParams();
  if (params?.storeId) searchParams.set("storeId", params.storeId);
  if (params?.platform) searchParams.set("platform", params.platform);
  if (params?.includeExpired) searchParams.set("includeExpired", "true");
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));
  const q = searchParams.toString();
  const url = `${API_ENDPOINT.admin.storeUnlinkRetention(userId)}${q ? `?${q}` : ""}`;
  const data = await getJson<{ result: AdminUnlinkRetentionListData }>(url);
  return data.result;
};

/** 어드민 실시간 작업 목록 (pending/processing/최근 갱신 순) */
export const getAdminRealtimeJobs: AsyncApiRequestFn<
  AdminRealtimeJobListData,
  { limit?: number }
> = async (params) => {
  const searchParams = new URLSearchParams();
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  const q = searchParams.toString();
  const url = `${API_ENDPOINT.admin.realtimeJobs}${q ? `?${q}` : ""}`;
  const data = await getJson<{ result: AdminRealtimeJobListData }>(url);
  return data.result;
};
