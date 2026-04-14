"use client";

import Link from "next/link";
import { DashboardShellTabIcon } from "@/app/(protected)/manage/dashboard/_components/DashboardShellTabIcon";
import { cn } from "@/lib/utils/cn";

export type ManageDashboardShellTabDef = {
  href: string;
  label: string;
  end: boolean;
};

type ManageDashboardShellNavProps = {
  tabs: readonly ManageDashboardShellTabDef[];
  pathname: string;
  getTabHref: (tabHref: string) => string;
  /** 어드민: 비활성 탭 스타일(테두리·배경)만 다름, 탭 아이콘은 회원과 동일 */
  variant?: "member" | "admin";
};

export function ManageDashboardShellNav({
  tabs,
  pathname,
  getTabHref,
  variant = "member",
}: ManageDashboardShellNavProps) {
  return (
    <nav
      className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-2"
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
              "flex h-[72px] w-[92px] shrink-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 px-1.5 py-1.5 text-center transition-colors",
              active
                ? "border-main-02 bg-main-03 text-white shadow-sm"
                : variant === "admin"
                  ? "border-border bg-white text-gray-02 hover:border-gray-03 hover:bg-gray-08"
                  : "border-gray-07 bg-gray-08 text-gray-02 hover:border-gray-06 hover:bg-gray-07",
            )}
          >
            <DashboardShellTabIcon href={tab.href} />
            <span className="typo-body-03-bold line-clamp-2 min-h-0 max-w-full leading-tight">
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
