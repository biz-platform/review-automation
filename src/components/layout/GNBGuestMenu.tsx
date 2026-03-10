"use client";

import Link from "next/link";
import {
  DropdownRoot,
  DropdownContent,
  DropdownItem,
  useDropdown,
} from "@/components/ui/dropdown";
import { cn } from "@/lib/utils/cn";

/** 빈 유저 아이콘 (비로그인 시 표시) */
function EmptyUserIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-6 w-6", className)}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
      />
    </svg>
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
