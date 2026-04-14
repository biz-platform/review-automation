"use client";

import { cn } from "@/lib/utils/cn";

export function SalesMetricLegend({
  label = "매출 금액",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 typo-body-02-regular text-gray-04",
        className,
      )}
    >
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-full bg-main-04"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

