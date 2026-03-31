"use client";

import Link from "next/link";
import {
  DropdownRoot,
  DropdownContent,
  DropdownItem,
  useDropdown,
} from "@/components/ui/dropdown";
import { UserProfileRasterIcon } from "@/components/ui/UserProfileRasterIcon";

/** 비로그인: 일반 유저 프로필 실루엣(40px 에셋, 버튼 안에서는 24px 표시) */
function EmptyUserIcon() {
  return (
    <UserProfileRasterIcon pixelSize={40} className="h-6 w-6" />
  );
}

function GuestMenuTrigger() {
  const { open, setOpen, triggerRef } = useDropdown();

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      aria-haspopup="menu"
      aria-label="로그인·회원가입 메뉴"
      onClick={() => setOpen(!open)}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-07 bg-transparent text-gray-04 transition-colors hover:border-gray-06 hover:bg-gray-08 hover:text-gray-02"
    >
      <EmptyUserIcon />
    </button>
  );
}

/**
 * 비로그인 시 GNB 우측: 빈 유저 아이콘 클릭 시 로그인·회원가입 드롭다운.
 */
export function GNBGuestMenu() {
  return (
    <DropdownRoot>
      <GuestMenuTrigger />
      <DropdownContent className="left-auto right-0 min-w-[160px]">
        <DropdownItem asChild>
          <Link
            href="/login"
            className="block w-full rounded px-2 py-1.5 typo-body-02-regular text-gray-01 no-underline hover:bg-gray-08"
          >
            로그인
          </Link>
        </DropdownItem>
        <DropdownItem asChild>
          <Link
            href="/signup"
            className="block w-full rounded px-2 py-1.5 typo-body-02-regular text-gray-01 no-underline hover:bg-gray-08"
          >
            회원가입
          </Link>
        </DropdownItem>
      </DropdownContent>
    </DropdownRoot>
  );
}
