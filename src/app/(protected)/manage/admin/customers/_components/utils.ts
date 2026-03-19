import type {
  AdminCustomerData,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { maskPhone as maskPhoneUtil } from "@/lib/utils/display-formatters";

export const maskPhone = maskPhoneUtil;

export function rowToOption(row: AdminCustomerData): AdminCustomerMemberTypeOption {
  if (row.role === "center_manager") return "center_manager";
  if (row.role === "planner") return "planner";
  return row.billing_state === "active" ? "paid_member" : "free_member";
}

export function optionToRole(
  option: AdminCustomerMemberTypeOption,
): "center_manager" | "planner" | "member" {
  if (option === "center_manager") return "center_manager";
  if (option === "planner") return "planner";
  return "member";
}

export function isSellerEligible(role: AdminCustomerData["role"]): boolean {
  return role === "center_manager" || role === "planner";
}

export function getMemberTypeClass(row: AdminCustomerData): string {
  if (row.role === "center_manager") {
    return "border-main-01 bg-main-05 text-main-01";
  }
  if (row.role === "planner") {
    return "border-gray-07 bg-gray-08 text-gray-04";
  }
  return row.billing_state === "active"
    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
    : "border-gray-07 bg-gray-08 text-gray-04";
}
