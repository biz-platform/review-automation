import type { AdminSellerTypeFilter } from "@/entities/admin/types";

export const PAGE_SIZE = 20;

export const SELLER_TYPE_FILTER_OPTIONS: {
  value: AdminSellerTypeFilter;
  label: string;
}[] = [
  { value: "all", label: "전체" },
  { value: "center_manager", label: "센터장" },
  { value: "planner", label: "플래너" },
];
