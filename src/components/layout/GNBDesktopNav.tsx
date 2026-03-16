"use client";

import Link from "next/link";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";
import { GNBGuestMenu } from "@/components/layout/GNBGuestMenu";
import { GNBUserMenu } from "@/components/layout/GNBUserMenu";

interface GNBDesktopNavProps {
  user: AuthSessionUser | null;
}

/** GNB 데스크톱 영역: 공지/가이드/고객센터 + 유저 또는 게스트 메뉴 */
export function GNBDesktopNav({ user }: GNBDesktopNavProps) {
  return (
    <nav className="hidden items-center gap-6 text-sm font-medium text-gray-01 lg:flex lg:gap-8">
      <Link href="/notice" className="hover:text-gray-03">
        공지사항
      </Link>
      <Link href="/guide" className="hover:text-gray-03">
        사용가이드
      </Link>
      <Link href="/support" className="hover:text-gray-03">
        고객센터
      </Link>
      {user ? (
        <GNBUserMenu email={user.email} name={user.name} variant="light" />
      ) : (
        <GNBGuestMenu />
      )}
    </nav>
  );
}
