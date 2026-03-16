/** 셀러 하위 고객 1건 (고객 관리 목록용) */
export type SellerCustomerData = {
  id: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  cumulative_payment_amount: number;
  last_payment_at: string | null;
};

/** 고객 목록 API 요청 */
export type SellerCustomersListApiRequestData = {
  limit?: number;
  offset?: number;
  email?: string;
};

/** 고객 목록 API 응답 */
export type SellerCustomersListData = {
  list: SellerCustomerData[];
  count: number;
};

/** 정산 요약 */
export type SettlementSummaryData = {
  paymentCount: number;
  estimatedSettlementAmount: number;
};

/** 정산 내역 1건 */
export type SettlementItemData = {
  id: string;
  email: string | null;
  phone: string | null;
  payment_amount: number;
  settlement_amount: number;
  payment_at: string;
};

/** 정산 목록 API 요청 */
export type SellerSettlementListApiRequestData = {
  limit?: number;
  offset?: number;
  emailOrPhone?: string;
  yearMonth?: string;
};

/** 정산 목록 API 응답 */
export type SellerSettlementListData = {
  summary: SettlementSummaryData;
  list: SettlementItemData[];
  count: number;
};
