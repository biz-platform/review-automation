"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/supabase";

/**
 * 루트(/) 랜딩 페이지. 비로그인·로그인 모두 접근 가능.
 * 비로그인: 로그인·회원가입 CTA / 로그인: 업장·리뷰 관리 진입 버튼.
 */
export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 md:py-16">
      <h1 className="typo-heading-01-bold text-center text-gray-01">
        매장 리뷰를 한곳에서 관리하세요
      </h1>
      <p className="typo-body-02-regular text-center text-gray-04">
        매장을 등록하고 플랫폼을 연동한 뒤 리뷰를 수집·관리할 수 있어요.
      </p>

      {isLoggedIn === null ? (
        <div className="h-12 w-48 animate-pulse rounded-lg bg-gray-07" />
      ) : isLoggedIn ? (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/manage/stores"
            className="flex min-w-[200px] items-center justify-center rounded-lg bg-main-03 px-6 py-3 typo-body-01-bold text-white outline-1 outline-main-02 hover:opacity-90"
          >
            업장 관리
          </Link>
          <Link
            href="/manage/reviews/manage"
            className="flex min-w-[200px] items-center justify-center rounded-lg bg-wgray-06 px-6 py-3 typo-body-01-bold text-gray-01 outline-1 outline-wgray-01 hover:opacity-90"
          >
            리뷰 관리
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="flex min-w-[200px] items-center justify-center rounded-lg bg-main-03 px-6 py-3 typo-body-01-bold text-white outline-1 outline-main-02 hover:opacity-90"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="flex min-w-[200px] items-center justify-center rounded-lg border border-gray-07 bg-white px-6 py-3 typo-body-01-bold text-gray-01 hover:bg-gray-08"
          >
            회원가입
          </Link>
        </div>
      )}
    </main>
  );
}
