"use client";

import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import downarrowIcon from "@/assets/icons/24px/downarrow.webp";

export type StoreDashboardUserOption = { userId: string; label: string };

type StoreDashboardUserSelectProps = {
  loading: boolean;
  options: StoreDashboardUserOption[];
  value: string;
  onChange: (userId: string) => void;
};

export function StoreDashboardUserSelect({
  loading,
  options,
  value,
  onChange,
}: StoreDashboardUserSelectProps) {
  return (
    <div className="relative min-w-0 max-w-lg flex-1">
      <select
        aria-label="고객 선택"
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
          <option value="">고객 목록 불러오는 중…</option>
        ) : options.length === 0 ? (
          <option value="">연동 고객 없음</option>
        ) : (
          options.map((o) => (
            <option key={o.userId} value={o.userId}>
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
