"use client";

import Link from "next/link";
import {
  DropdownRoot,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/dropdown";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { UserProfileRasterIcon } from "@/components/ui/UserProfileRasterIcon";
import { cn } from "@/lib/utils/cn";

export interface GNBUserMenuProps {
  email: string;
  name: string;
  /** dark: 인증 영역(다크 헤더). light: 공용 GNB(흰 헤더) */
  variant?: "dark" | "light";
}

/** GNB 우측: 유저 아바타 + 등급 배지(센터장/플래너) + 이메일, 드롭다운(마이페이지, 로그아웃) */
export function GNBUserMenu({
  email,
  name,
  variant = "dark",
}: GNBUserMenuProps) {
  const { signOut } = useSignOut();
  const { data: profile } = useAccountProfile();
  const displayName = name || email?.split("@")[0] || "사용자";
  const isLight = variant === "light";

  const roleBadgeLabel =
    profile?.role === "center_manager"
      ? "센터장"
      : profile?.role === "planner"
        ? "플래너"
        : null;
  const isSeller = profile?.is_seller ?? false;
  const isAdmin = profile?.is_admin ?? false;

  const badgeBaseClass = cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-0.5 text-[10px] font-medium leading-4",
    isLight
      ? "border-lime-600 bg-lime-50 text-lime-700"
      : "border-white/40 bg-white/20 text-white",
  );
  const sellerBadgeClass = cn(
    "inline-flex shrink-0 items-center justify-center rounded-lg border px-2.5 py-0.5 text-[10px] font-medium leading-4",
    isLight
      ? "border-orange-400 bg-orange-100 text-orange-400"
      : "border-white/40 bg-white/20 text-white",
  );

  return (
    <DropdownRoot>
      <DropdownTrigger
        showChevron={false}
        className={cn(
          "h-auto min-h-[38px] min-w-0 max-w-[320px] border-transparent bg-transparent py-1.5 pr-2 hover:border-opacity-20 focus-visible:ring-white/30",
          isLight
            ? "text-gray-01 hover:bg-gray-08"
            : "text-white hover:bg-white/10 hover:border-white/20",
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-3.5">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border",
              isLight
                ? "border-neutral-200 bg-stone-50"
                : "border-white/40 bg-white/20",
            )}
            aria-hidden
          >
            <UserProfileRasterIcon isAdmin={isAdmin} />
          </span>
          <div className="flex w-48 min-w-0 flex-col items-start gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {isAdmin && (
                <span
                  className={cn(
                    badgeBaseClass,
                    isLight
                      ? "border-gray-800 bg-gray-900 text-white"
                      : "border-white/40 bg-white/20 text-white",
                  )}
                >
                  관리자
                </span>
              )}
              {roleBadgeLabel != null && (
                <span className={badgeBaseClass}>{roleBadgeLabel}</span>
              )}
              {isSeller && <span className={sellerBadgeClass}>셀러</span>}
            </div>
            <span
              className={cn(
                "min-w-0 truncate text-sm font-medium leading-5",
                isLight ? "text-neutral-800" : "text-white",
              )}
            >
              {email || displayName}
            </span>
          </div>
        </span>
      </DropdownTrigger>
      <DropdownContent className="left-auto right-0 min-w-[200px]">
        <div className="border-b border-gray-07 px-3 pb-3 typo-body-02-regular text-gray-04">
          {email}
        </div>
        {profile?.is_admin && (
          <DropdownItem asChild>
            <Link
              href="/manage/admin/store-dashboard/summary"
              className="block w-full rounded px-2 py-1.5 typo-body-02-regular text-gray-01 no-underline hover:bg-gray-08"
            >
              어드민 페이지
            </Link>
          </DropdownItem>
        )}
        <DropdownItem asChild>
          <Link
            href="/manage/mypage"
            className="block w-full rounded px-2 py-1.5 typo-body-02-regular text-gray-01 no-underline hover:bg-gray-08"
          >
            마이페이지
          </Link>
        </DropdownItem>

        <DropdownItem onSelect={() => void signOut()}>로그아웃</DropdownItem>
      </DropdownContent>
    </DropdownRoot>
  );
}
