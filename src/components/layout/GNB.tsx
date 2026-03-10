"use client";

import Link from "next/link";
import { useAuthSession } from "@/lib/hooks/use-auth-session";
import { GNBGuestMenu } from "@/components/layout/GNBGuestMenu";
import { GNBUserMenu } from "@/components/layout/GNBUserMenu";

/**
 * 전 페이지 공통 GNB. 로그인 여부에 따라 우측만 다르게 표시.
 * - 비로그인: 빈 유저 아이콘 → 클릭 시 로그인·회원가입 드롭다운
 * - 로그인: 유저 메뉴(아바타·드롭다운)
 * 매장 관리·리뷰 관리는 /manage 하위 SNB(LNB)에만 있음.
 */
export function GNB() {
  const user = useAuthSession();

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-gray-07 bg-white px-4 md:h-20 md:px-10">
      <Link href="/" className="flex items-center gap-2">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-main-02 md:h-8 md:w-8"
          aria-hidden
        />
        <span className="text-base font-semibold text-gray-01 md:text-lg">
          Oliview
        </span>
      </Link>

      <nav className="hidden items-center gap-6 text-sm font-medium text-gray-01 md:flex md:gap-8">
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
          <GNBUserMenu
            email={user.email}
            name={user.name}
            variant="light"
          />
        ) : (
          <GNBGuestMenu />
        )}
      </nav>

      <button
        type="button"
        className="flex h-7 w-7 items-center justify-center md:hidden"
        aria-label="메뉴 열기"
      >
        <span className="flex flex-col gap-1.5">
          <span className="h-0.5 w-6 rounded-full bg-gray-01" />
          <span className="h-0.5 w-6 rounded-full bg-gray-01" />
          <span className="h-0.5 w-6 rounded-full bg-gray-01" />
        </span>
      </button>
    </header>
  );
}
