"use client";

import { Button } from "@/components/ui/button";
import type { AdminCustomerData } from "@/entities/admin/types";
import { ADMIN_CUSTOMER_SELLER_STATUS_BADGE_CLASS } from "./constants";
import { isSellerEligible } from "./utils";

export interface SellerRegisterCellProps {
  row: AdminCustomerData;
  onRegister: (row: AdminCustomerData) => void;
  saving: boolean;
}

export function SellerRegisterCell({
  row,
  onRegister,
  saving,
}: SellerRegisterCellProps) {
  if (!isSellerEligible(row.role)) {
    return <span className="text-gray-05">—</span>;
  }
  if (row.is_seller) {
    return (
      <span className={ADMIN_CUSTOMER_SELLER_STATUS_BADGE_CLASS}>등록 완료</span>
    );
  }
  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      disabled={saving}
      onClick={() => onRegister(row)}
      className="text-sm text-gray-05 hover:text-gray-01"
    >
      {saving ? "처리 중…" : "신규 등록"}
    </Button>
  );
}
