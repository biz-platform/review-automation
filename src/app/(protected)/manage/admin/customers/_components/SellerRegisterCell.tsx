"use client";

import { Button } from "@/components/ui/button";
import type { AdminCustomerData } from "@/entities/admin/types";
import { isSellerEligible } from "./utils";

/** Figma 138:8631 색·보더·radius·px; 너비는 실제 폰트에 맞게 hug (92px 고정 시 굵은체에서 줄바꿈·클리핑 발생) */
const badgeClass =
  "inline-flex min-h-[35px] shrink-0 items-center justify-center whitespace-nowrap rounded border border-blue-01 bg-blue-02 px-4 typo-body-01-bold text-white";

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
