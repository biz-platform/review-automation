"use client";

import { Button } from "@/components/ui/button";
import type { AdminCustomerData } from "@/entities/admin/types";
import { cn } from "@/lib/utils/cn";
import { ADMIN_CUSTOMER_BADGE_MATCH_ACTION } from "./constants";
import { canLinkReferral } from "./utils";

export interface AdminCustomerReferralCellProps {
  row: AdminCustomerData;
  onConnect: (row: AdminCustomerData) => void;
  saving: boolean;
}

export function AdminCustomerReferralCell({
  row,
  onConnect,
  saving,
}: AdminCustomerReferralCellProps) {
  if (!canLinkReferral(row)) {
    return <span className="text-gray-05">—</span>;
  }

  const linked = row.referred_by_user_id != null;

  const actionButtonClass = cn(
    "self-start text-gray-05 hover:text-gray-01",
    ADMIN_CUSTOMER_BADGE_MATCH_ACTION,
  );

  if (!linked) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={saving}
        onClick={() => onConnect(row)}
        className={actionButtonClass}
      >
        {saving ? "처리 중…" : "연결"}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="md"
      disabled={saving}
      onClick={() => onConnect(row)}
      className={actionButtonClass}
    >
      {saving ? "처리 중…" : "셀러 정보"}
    </Button>
  );
}
