"use client";

import { cn } from "@/lib/utils/cn";

interface GNBMobileToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

/** GNB 모바일 햄버거 토글 버튼 */
export function GNBMobileToggle({ isOpen, onToggle }: GNBMobileToggleProps) {
  return (
    <button
      type="button"
      className="flex h-7 w-7 items-center justify-center lg:hidden"
      aria-label={isOpen ? "메뉴 닫기" : "메뉴 열기"}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <span
        className={cn(
          "flex flex-col gap-1.5 transition-transform",
          isOpen && "gap-0",
        )}
      >
        <span
          className={cn(
            "h-0.5 w-6 rounded-full bg-gray-01 transition-all",
            isOpen && "translate-y-[3px] rotate-45",
          )}
        />
        <span
          className={cn(
            "h-0.5 w-6 rounded-full bg-gray-01 transition-all",
            isOpen && "opacity-0",
          )}
        />
        <span
          className={cn(
            "h-0.5 w-6 rounded-full bg-gray-01 transition-all",
            isOpen && "-translate-y-[3px] -rotate-45",
          )}
        />
      </span>
    </button>
  );
}
