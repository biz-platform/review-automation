"use client";

import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { DashboardShellTabIcon } from "@/app/(protected)/manage/dashboard/_components/DashboardShellTabIcon";

export type DashboardShellTabDef = {
  href: string;
  label: string;
  end: boolean;
};

type DashboardShellNavProps = {
  tabs: readonly DashboardShellTabDef[];
  pathname: string;
  getTabHref: (tabHref: string) => string;
};

export function DashboardShellNav({
  tabs,
  pathname,
  getTabHref,
}: DashboardShellNavProps) {
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
                : "border-gray-07 bg-gray-08 text-gray-02 hover:border-gray-06 hover:bg-gray-07",
            )}
          >
            <DashboardShellTabIcon href={tab.href} />
            <span className="typo-body-03-bold leading-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
