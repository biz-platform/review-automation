"use client";

import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import downarrowIcon from "@/assets/icons/24px/downarrow.webp";
import { useState } from "react";
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  useDropdown,
} from "@/components/ui/dropdown";

export type StoreDashboardStoreOption = { storeId: string; label: string };

type StoreDashboardStoreSelectProps = {
  listLoading: boolean;
  options: StoreDashboardStoreOption[];
  value: string;
  userId: string;
  onChange: (storeId: string) => void;
};

export function StoreDashboardStoreSelect({
  listLoading,
  options,
  value,
  userId,
  onChange,
}: StoreDashboardStoreSelectProps) {
  const [open, setOpen] = useState(false);
  const disabled = !userId || options.length === 0 || listLoading;
  const selected =
    options.find((o) => o.storeId === value)?.label ??
    (options.length === 0
      ? listLoading
        ? "불러오는 중…"
        : "연동 매장 없음"
      : (options[0]?.label ?? "매장 전체"));

  return (
    <div className="relative w-full min-w-0 max-w-lg flex-1">
      {/* mobile: custom dropdown to constrain panel width */}
      <div className="sm:hidden">
        <DropdownRoot open={open} onOpenChange={setOpen} className="block w-full">
          <MobileSelectTrigger
            disabled={disabled}
            onToggle={() => setOpen(!open)}
            ariaLabel="매장 선택"
          >
            {selected}
          </MobileSelectTrigger>
          <DropdownContent
            matchTriggerWidth
            constrainToViewport
            className="left-0 min-w-0 max-w-none w-full gap-0 p-1"
          >
            {options.length === 0 ? (
              <DropdownItem asChild>
                <span className="typo-body-02-regular text-gray-03">
                  {listLoading ? "불러오는 중…" : "연동 매장 없음"}
                </span>
              </DropdownItem>
            ) : (
              options.map((o) => (
                <DropdownItem
                  key={o.storeId}
                  onSelect={() => onChange(o.storeId)}
                  className={cn(
                    "px-3 py-2",
                    o.storeId === value && "bg-gray-08",
                  )}
                >
                  <span className="truncate">{o.label}</span>
                </DropdownItem>
              ))
            )}
          </DropdownContent>
        </DropdownRoot>
      </div>

      {/* desktop: keep native select */}
      <div className="hidden sm:block">
        <select
          aria-label="매장 선택"
          className={cn(
            // 유저 대시보드 셀렉트 톤으로 복구
            "h-10 w-full cursor-pointer appearance-none rounded-lg border border-border bg-white pl-3 pr-10",
            "typo-body-01-bold text-gray-01 shadow-sm",
            "sm:h-auto sm:rounded-xl sm:py-3 sm:pl-4 sm:pr-12 sm:typo-heading-02-bold",
            "transition-colors hover:border-gray-03 focus:border-main-01 focus:outline-none focus:ring-2 focus:ring-main-01/25",
          )}
          value={value}
          disabled={!userId || options.length === 0 || listLoading}
          onChange={(e) => onChange(e.target.value)}
        >
          {options.length === 0 ? (
            <option value="">
              {listLoading ? "불러오는 중…" : "연동 매장 없음"}
            </option>
          ) : (
            options.map((o) => (
              <option key={o.storeId} value={o.storeId}>
                {o.label}
              </option>
            ))
          )}
        </select>
        <span
          className="pointer-events-none absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-gray-03 sm:right-3 sm:h-8 sm:w-8"
          aria-hidden
        >
          <Icon24
            src={downarrowIcon}
            alt=""
            className="opacity-70 scale-90 sm:scale-100"
          />
        </span>
      </div>
    </div>
  );
}

function MobileSelectTrigger({
  children,
  disabled,
  onToggle,
  ariaLabel,
}: {
  children: string;
  disabled: boolean;
  onToggle: () => void;
  ariaLabel: string;
}) {
  const { open, triggerRef } = useDropdown();
  return (
    <button
      ref={triggerRef}
      type="button"
      aria-label={ariaLabel}
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative flex h-10 w-full min-w-0 items-center justify-between rounded-lg border border-border bg-white pl-3 pr-10 shadow-sm",
        "typo-body-01-bold text-gray-01",
        "transition-colors hover:border-gray-03 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-main-01/25",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
      <span
        className="pointer-events-none absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center text-gray-03"
        aria-hidden
      >
        <Icon24 src={downarrowIcon} alt="" className="opacity-70 scale-90" />
      </span>
    </button>
  );
}
