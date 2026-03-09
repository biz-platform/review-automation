"use client";

import Link from "next/link";
import { SignOutButton } from "@/components/shared/SignOutButton";

export type GNBVariant = "public" | "authenticated";

export interface GNBProps {
  /** public: 로고 + 공지/가이드/고객센터(흰 헤더). authenticated: 앱 네비 + 로그아웃(다크 헤더) */
  variant: GNBVariant;
}

/**
 * 상단 고정 GNB. 로그인/회원가입은 variant="public", 로그인 후 영역은 variant="authenticated".
 */
export function GNB({ variant }: GNBProps) {
  if (variant === "authenticated") {
    return (
      <header className="sticky top-0 z-10 h-20 shrink-0 border-b border-border bg-gray-01 px-4 md:px-6">
        <nav className="flex h-full items-center gap-4">
          <Link href="/stores" className="font-medium text-white hover:opacity-90">
            매장 관리
          </Link>
          <Link
            href="/reviews/manage"
            className="font-medium text-white hover:opacity-90"
          >
            리뷰 관리
          </Link>
          <Link href="/" className="text-white/80 hover:text-white">
            홈
          </Link>
          <span className="ml-auto [&_button]:text-white/80 [&_button]:hover:text-white [&_button]:no-underline">
            <SignOutButton />
          </span>
        </nav>
      </header>
    );
  }

  // public: 로고 + 공지사항/사용가이드/고객센터, 모바일 햄버거
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
