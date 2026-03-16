"use client";

import { useState } from "react";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";
import { GNBGuestMenu } from "@/components/layout/GNBGuestMenu";
import { GNBUserMenu } from "@/components/layout/GNBUserMenu";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";
import { NOTION_USER_GUIDE_URL, NOTION_NOTICE_URL } from "@/const/links";

interface GNBDesktopNavProps {
  user: AuthSessionUser | null;
}

/** GNB 데스크톱 영역: 공지/가이드/고객센터 + 유저 또는 게스트 메뉴 */
export function GNBDesktopNav({ user }: GNBDesktopNavProps) {
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  return (
    <nav className="hidden items-center gap-6 text-sm font-medium text-gray-01 lg:flex lg:gap-8">
      <a
        href={NOTION_NOTICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-03"
      >
        공지사항
      </a>
      <a
        href={NOTION_USER_GUIDE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-gray-03"
      >
        사용가이드
      </a>
      <button
        type="button"
        onClick={() => setComingSoonOpen(true)}
        className="hover:text-gray-03"
      >
        고객센터
      </button>
      {user ? (
        <GNBUserMenu email={user.email} name={user.name} variant="light" />
      ) : (
        <GNBGuestMenu />
      )}
      <ComingSoonModal
        open={comingSoonOpen}
        onOpenChange={(open) => !open && setComingSoonOpen(false)}
      />
    </nav>
  );
}
