"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthSession } from "@/lib/hooks/use-auth-session";
import { GNBLogo } from "@/components/layout/GNBLogo";
import { GNBDesktopNav } from "@/components/layout/GNBDesktopNav";
import { GNBMobileToggle } from "@/components/layout/GNBMobileToggle";
import { GNBMobileDropdown } from "@/components/layout/GNBMobileDropdown";

/**
 * 전 페이지 공통 GNB.
 * - 데스크톱: 좌측 로고, 우측 메뉴 + 유저/게스트 메뉴
 * - 모바일: 햄버거 기준 우측 상단 min-w 드롭다운
 */
export function GNB() {
  const user = useAuthSession();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);
  const mobileMenuPortalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inHeader = headerRef.current?.contains(target);
      const inMenuPortal = mobileMenuPortalRef.current?.contains(target);
      if (!inHeader && !inMenuPortal) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, [isMobileMenuOpen]);

  return (
    <header className="sticky top-0 z-10 border-b border-gray-07 bg-white">
      <div
        ref={headerRef}
        className="relative flex h-14 items-center justify-between px-4 lg:h-20 lg:px-10"
      >
        <GNBLogo />
        <GNBDesktopNav user={user} />
        <GNBMobileToggle
          isOpen={isMobileMenuOpen}
          onToggle={() => setIsMobileMenuOpen((prev) => !prev)}
        />
        <GNBMobileDropdown
          user={user}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
          menuPortalRef={mobileMenuPortalRef}
        />
      </div>
    </header>
  );
}
