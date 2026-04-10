"use client";

import type { AdminDashboardRange } from "@/entities/admin/types";
import { ManageDashboardRangeToggle } from "@/app/(protected)/manage/_components/ManageDashboardRangeToggle";

type StoreDashboardRangeButtonsProps = {
  value: AdminDashboardRange;
  onChange: (value: AdminDashboardRange) => void;
};

export function StoreDashboardRangeButtons({
  value,
  onChange,
}: StoreDashboardRangeButtonsProps) {
  return <ManageDashboardRangeToggle value={value} onChange={onChange} />;
}
