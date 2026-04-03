"use client";

import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import downarrowIcon from "@/assets/icons/24px/downarrow.webp";

export type DashboardStoreSelectOption = { id: string; label: string };

type DashboardStoreSelectProps = {
  loading: boolean;
  options: DashboardStoreSelectOption[];
  value: string;
  onChange: (storeId: string) => void;
};

export function DashboardStoreSelect({
  loading,
  options,
  value,
  onChange,
}: DashboardStoreSelectProps) {
  return (
    <div className="relative min-w-0 max-w-lg">
      <select
        aria-label="매장 선택"
        className={cn(
          "w-full cursor-pointer appearance-none rounded-xl border border-border bg-white py-3 pl-4 pr-12",
          "typo-heading-02-bold text-gray-01 shadow-sm",
          "transition-colors hover:border-gray-03 focus:border-main-01 focus:outline-none focus:ring-2 focus:ring-main-01/25",
        )}
        value={loading ? "" : value}
        disabled={loading || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
      >
        {loading ? (
          <option value="">불러오는 중…</option>
        ) : options.length === 0 ? (
          <option value="">연동 매장 없음</option>
        ) : (
          options.map((o, idx) => (
            <option key={`${o.id}-${idx}`} value={o.id}>
              {o.label}
            </option>
          ))
        )}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-gray-03"
        aria-hidden
      >
        <Icon24 src={downarrowIcon} alt="" className="opacity-70" />
      </span>
    </div>
  );
}
