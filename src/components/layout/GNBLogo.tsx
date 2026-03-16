"use client";

import Link from "next/link";

/** GNB 좌측 로고 링크 (랜딩과 동일한 서비스 전역 로고) */
export function GNBLogo() {
  return (
    <Link href="/" className="flex items-center">
      <img
        src="/logo_text.svg"
        alt="Oliview"
        className="h-7 w-auto lg:h-8"
        width={300}
        height={55}
      />
    </Link>
  );
}
