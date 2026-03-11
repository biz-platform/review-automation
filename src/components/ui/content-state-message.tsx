"use client";

import { cn } from "@/lib/utils/cn";

export interface ContentStateMessageProps {
  variant: "loading" | "error";
  message?: string;
  className?: string;
}

export function ContentStateMessage({
  variant,
  message,
  className,
}: ContentStateMessageProps) {
  return (
    <div
      className={cn(
        "flex min-h-[320px] items-center justify-center",
        className
      )}
    >
      <p
        className={
          variant === "error"
            ? "typo-body-02-regular text-red-01"
            : "typo-body-02-regular text-gray-04"
        }
      >
        {message ?? (variant === "loading" ? "로딩 중…" : "오류가 발생했습니다.")}
      </p>
    </div>
  );
}
