"use client";

import { Button } from "@/components/ui/button";
import type { AdminCustomerData } from "@/entities/admin/types";
import { isSellerEligible } from "./utils";

const badgeClass =
  "inline-flex items-center rounded-lg border border-blue-500 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700";

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
    return <span className={badgeClass}>등록 완료</span>;
  }
  return (
    <Button
      type="button"
      variant="secondaryDark"
      size="md"
      disabled={saving}
      onClick={() => onRegister(row)}
      className="text-sm"
    >
      {saving ? "처리 중…" : "신규 등록"}
    </Button>
  );
}
