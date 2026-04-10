/**
 * 배민 self-api 주문 내역 v4 (`/v4/orders` 등) 페이로드에서 대시보드 집계에 쓰는 필드만 정의.
 * 수집은 별도 워커에서 수행한다고 가정.
 */

export type BaeminV4OrderItem = {
  name?: string;
  /** 라인 매출(원). quantity와 별도로 이미 합산된 금액으로 취급 */
  totalPrice?: number;
  quantity?: number;
};

export type BaeminV4OrderCore = {
  orderNumber?: string;
  /** 집계 대상: `CLOSED` 만 */
  status?: string;
  payAmount?: number;
  /** ISO datetime */
  orderDateTime?: string;
  shopNumber?: number;
  deliveryType?: string;
  payType?: string;
  items?: BaeminV4OrderItem[];
};

export type BaeminV4SettleCore = {
  total?: number | null;
  depositDueAmount?: number | null;
};

export type BaeminV4OrderContentRow = {
  order?: BaeminV4OrderCore;
  settle?: BaeminV4SettleCore;
};

/** KST 일별 요약 (DB `store_platform_dashboard_daily`, platform=baemin 행과 대응) */
export type BaeminDashboardDailyAggregate = {
  kstDate: string;
  orderCount: number;
  totalPayAmount: number;
  settlementAmount: number;
  avgOrderAmount: number | null;
  totalMenuQuantity: number;
  distinctMenuCount: number;
  /** 리뷰 테이블과 합친 뒤 채움 */
  reviewCount?: number | null;
  reviewConversionRatio?: number | null;
  syncStatus?: "complete" | "partial";
  lastError?: string | null;
};

export type BaeminDashboardMenuDailyAggregate = {
  kstDate: string;
  menuName: string;
  quantity: number;
  lineTotal: number;
  shareOfDayRevenue: number | null;
};

export type BaeminDashboardPersistBundle = {
  daily: BaeminDashboardDailyAggregate[];
  menus: BaeminDashboardMenuDailyAggregate[];
};
