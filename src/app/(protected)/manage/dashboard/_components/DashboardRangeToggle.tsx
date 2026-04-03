"use client";

import type { DashboardRange } from "@/entities/dashboard/types";
import { cn } from "@/lib/utils/cn";

const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: "30d", label: "한 달" },
  { value: "7d", label: "최근 7일" },
] as const;

type DashboardRangeToggleProps = {
  value: DashboardRange;
  onChange: (value: DashboardRange) => void;
};

export function DashboardRangeToggle({
  value,
  onChange,
}: DashboardRangeToggleProps) {
  return (
    <div role="group" aria-label="기간 선택">
      <div className="inline-flex rounded-lg border border-gray-07 bg-gray-08 p-1">
        {RANGE_OPTIONS.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={cn(
                "min-w-[92px] rounded-lg px-4 py-2 typo-body-03-bold transition-colors",
                active
                  ? "bg-white text-gray-01 shadow-sm"
                  : "text-gray-04 hover:bg-gray-07",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
