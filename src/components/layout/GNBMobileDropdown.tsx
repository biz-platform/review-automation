"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { cn } from "@/lib/utils/cn";

interface GNBMobileDropdownProps {
  user: AuthSessionUser | null;
  isOpen: boolean;
  onClose: () => void;
}

/** GNB 모바일 전용 드롭다운 (햄버거 기준 우측, min-w) */
export function GNBMobileDropdown({
  user,
  isOpen,
  onClose,
}: GNBMobileDropdownProps) {
  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-1 flex justify-end md:hidden",
        isOpen
          ? "visible opacity-100"
          : "invisible opacity-0 pointer-events-none",
      )}
    >
      <div className="min-w-[200px] rounded-md border border-gray-07 bg-white px-3 py-3 text-right text-sm font-medium text-gray-01 shadow-lg">
        <nav className="flex flex-col gap-1">
          <MobileNavLink href="/notice" onClick={onClose}>
            공지사항
          </MobileNavLink>
          <MobileNavLink href="/guide" onClick={onClose}>
            사용가이드
          </MobileNavLink>
          <MobileNavLink href="/support" onClick={onClose}>
            고객센터
          </MobileNavLink>
          {user ? (
            <>
              <MobileNavLink href="/manage/mypage" onClick={onClose}>
                마이페이지
              </MobileNavLink>
              <MobileLogoutButton onClose={onClose} />
            </>
          ) : (
            <>
              <MobileNavLink href="/login" onClick={onClose}>
                로그인
              </MobileNavLink>
              <MobileNavLink href="/signup" onClick={onClose}>
                회원가입
              </MobileNavLink>
            </>
          )}
        </nav>
      </div>
    </div>
  );
}

function MobileNavLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="block rounded-md px-2 py-2 text-right hover:bg-gray-08 hover:text-gray-02"
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

function MobileLogoutButton({ onClose }: { onClose: () => void }) {
  const { signOut } = useSignOut();
  return (
    <button
      type="button"
      className="block w-full rounded-md px-2 py-2 text-right hover:bg-gray-08 hover:text-gray-02"
      onClick={() => {
        onClose();
        signOut();
      }}
    >
      로그아웃
    </button>
  );
}
