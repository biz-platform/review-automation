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
