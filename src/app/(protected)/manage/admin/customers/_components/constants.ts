import type {
  AdminCustomerFilterValue,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { cn } from "@/lib/utils/cn";

export const PAGE_SIZE = 20;

/** 셀러 등록「등록 완료」뱃지와 동일 min-height·패딩·타이포 (「연결」 등 동일 사이즈 액션) */
export const ADMIN_CUSTOMER_BADGE_MATCH_ACTION =
  "min-h-[35px] min-w-0 shrink-0 px-4 typo-body-01-bold";

/** 셀러 등록「등록 완료」·셀러 연결「셀러」공통 스타일 (Figma 138:8631) */
export const ADMIN_CUSTOMER_SELLER_STATUS_BADGE_CLASS = cn(
  "inline-flex items-center justify-center whitespace-nowrap rounded border border-blue-01 bg-blue-02 text-white",
  ADMIN_CUSTOMER_BADGE_MATCH_ACTION,
);

export const FILTER_OPTIONS: {
  value: AdminCustomerFilterValue;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "center_manager", label: "센터장" },
  { value: "planner", label: "플래너" },
  { value: "paid_member", label: "유료 회원" },
  { value: "free_member", label: "무료 회원" },
];

export const MEMBER_TYPE_DROPDOWN_OPTIONS: {
  value: AdminCustomerMemberTypeOption;
  label: string;
}[] = [
  { value: "center_manager", label: "센터장" },
  { value: "planner", label: "플래너" },
  { value: "paid_member", label: "유료 회원" },
  { value: "free_member", label: "무료 회원" },
];
