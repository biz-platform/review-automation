"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { StoreDashboardShellTabIcon } from "@/app/(protected)/manage/admin/store-dashboard/_components/StoreDashboardShellTabIcon";

export type StoreDashboardShellTabDef = {
  href: string;
  label: string;
  end: boolean;
};

type StoreDashboardShellNavProps = {
  tabs: readonly StoreDashboardShellTabDef[];
  pathname: string;
  getTabHref: (tabHref: string) => string;
};

export function StoreDashboardShellNav({
  tabs,
  pathname,
  getTabHref,
}: StoreDashboardShellNavProps) {
  return (
    <nav
      className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 lg:max-w-[760px] lg:flex-1"
      aria-label="매장 대시보드 탭"
    >
      {tabs.map((tab) => {
        const active = tab.end
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={getTabHref(tab.href)}
            className={cn(
              "flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-center transition-colors",
              active
                ? "border-main-02 bg-main-03 text-white shadow-sm"
                : "border-border bg-white text-gray-02 hover:border-gray-03 hover:bg-gray-08",
            )}
          >
            <StoreDashboardShellTabIcon href={tab.href} />
            <span className="typo-body-03-bold leading-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
