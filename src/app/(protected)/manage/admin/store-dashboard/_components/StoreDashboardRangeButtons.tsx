"use client";

import type { AdminDashboardRange } from "@/entities/admin/types";
import { cn } from "@/lib/utils/cn";

const RANGE_OPTIONS: { value: AdminDashboardRange; label: string }[] = [
  { value: "7d", label: "최근 7일" },
  { value: "30d", label: "한 달" },
];

type StoreDashboardRangeButtonsProps = {
  value: AdminDashboardRange;
  onChange: (value: AdminDashboardRange) => void;
};

export function StoreDashboardRangeButtons({
  value,
  onChange,
}: StoreDashboardRangeButtonsProps) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end"
      role="group"
      aria-label="기간 선택"
    >
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full px-5 py-2.5 typo-body-03-bold transition-colors",
            value === o.value
              ? "bg-gray-01 text-white"
              : "bg-gray-08 text-gray-02 hover:bg-gray-07",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
