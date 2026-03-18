import type {
  AdminCustomerFilterValue,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";

export const PAGE_SIZE = 20;

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
