"use client";

import Link from "next/link";
import {
  DropdownRoot,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/dropdown";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { cn } from "@/lib/utils/cn";

export interface GNBUserMenuProps {
  email: string;
  name: string;
  /** dark: 인증 영역(다크 헤더). light: 공용 GNB(흰 헤더) */
  variant?: "dark" | "light";
}

/** GNB 우측: 유저 아바타 + 이메일/이름, 드롭다운(마이페이지, 로그아웃) */
export function GNBUserMenu({
  email,
  name,
  variant = "dark",
}: GNBUserMenuProps) {
  const { signOut, isPending } = useSignOut();
  const displayName = name || email?.split("@")[0] || "사용자";
  const initial = displayName.slice(0, 1).toUpperCase();
  const isLight = variant === "light";

  return (
    <DropdownRoot>
      <DropdownTrigger
        className={cn(
          "min-w-0 max-w-[280px] border-transparent bg-transparent hover:border-opacity-20 focus-visible:ring-white/30",
          isLight
            ? "text-gray-01 hover:bg-gray-08"
            : "text-white hover:bg-white/10 hover:border-white/20",
        )}
        icon={
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
              isLight ? "bg-gray-07 text-gray-01" : "bg-white/20 text-white",
            )}
            aria-hidden
          >
            {initial}
          </span>
        }
      >
        <span className="truncate">{displayName}</span>
      </DropdownTrigger>
      <DropdownContent className="left-auto right-0 min-w-[200px]">
        <div className="border-b border-gray-07 px-3 pb-3 typo-body-02-regular text-gray-04">
          {email}
        </div>
        <DropdownItem asChild>
          <Link
            href="/manage/mypage"
            className="block w-full rounded px-2 py-1.5 typo-body-02-regular text-gray-01 no-underline hover:bg-gray-08"
          >
            마이페이지
          </Link>
        </DropdownItem>
        <DropdownItem onSelect={() => void signOut()}>
          로그아웃
        </DropdownItem>
      </DropdownContent>
    </DropdownRoot>
  );
}
