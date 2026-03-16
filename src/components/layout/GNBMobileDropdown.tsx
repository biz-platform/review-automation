"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { cn } from "@/lib/utils/cn";
import { ManageMobileMenu } from "@/components/layout/ManageMobileMenu";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";
import { NOTION_USER_GUIDE_URL } from "@/const/links";

interface GNBMobileDropdownProps {
  user: AuthSessionUser | null;
  isOpen: boolean;
  onClose: () => void;
  /** 전체화면 메뉴 포털 루트 (클릭 아웃사이드 제외용) */
  menuPortalRef?: React.RefObject<HTMLDivElement | null>;
}

/** GNB 모바일 전용: /manage 경로+로그인 시 전체화면 메뉴, 그 외엔 우측 드롭다운 */
export function GNBMobileDropdown({
  user,
  isOpen,
  onClose,
  menuPortalRef,
}: GNBMobileDropdownProps) {
  const pathname = usePathname();
  const isManageRoute = pathname?.startsWith("/manage") ?? false;
  const showManageMenu = isOpen && isManageRoute && user != null;
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  if (showManageMenu && typeof document !== "undefined") {
    return createPortal(
      <>
        <button
          type="button"
          className="fixed inset-0 z-[100] bg-gray-01 lg:hidden"
          aria-label="메뉴 닫기"
          onClick={onClose}
        />
        <div
          ref={menuPortalRef}
          className="fixed inset-0 z-[100] overflow-y-auto bg-white lg:hidden"
        >
          <ManageMobileMenu user={user} onClose={onClose} />
        </div>
      </>,
      document.body,
    );
  }

  return (
    <div
      className={cn(
        "absolute right-0 top-full mt-1 flex justify-end lg:hidden",
        isOpen
          ? "visible opacity-100"
          : "invisible opacity-0 pointer-events-none",
      )}
    >
      <div className="min-w-[200px] rounded-md border border-gray-07 bg-white px-3 py-3 text-right text-sm font-medium text-gray-01 shadow-lg">
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            className="block w-full rounded-md px-2 py-2 text-right hover:bg-gray-08 hover:text-gray-02"
            onClick={() => {
              onClose();
              setComingSoonOpen(true);
            }}
          >
            공지사항
          </button>
          <a
            href={NOTION_USER_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md px-2 py-2 text-right hover:bg-gray-08 hover:text-gray-02"
            onClick={onClose}
          >
            사용가이드
          </a>
          <button
            type="button"
            className="block w-full rounded-md px-2 py-2 text-right hover:bg-gray-08 hover:text-gray-02"
            onClick={() => {
              onClose();
              setComingSoonOpen(true);
            }}
          >
            고객센터
          </button>
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
      <ComingSoonModal
        open={comingSoonOpen}
        onOpenChange={(open) => !open && setComingSoonOpen(false)}
      />
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
