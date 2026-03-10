"use client";

import Link from "next/link";

/** GNB 좌측 로고 링크 */
export function GNBLogo() {
  return (
    <Link href="/" className="flex items-center gap-2">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-main-02 md:h-8 md:w-8"
        aria-hidden
      />
      <span className="text-base font-semibold text-gray-01 md:text-lg">
        Oliview
      </span>
    </Link>
  );
}
