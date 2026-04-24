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
  const resolvedMessage =
    message ?? (variant === "loading" ? "로딩 중…" : "오류가 발생했습니다.");

  return (
    <div
      className={cn(
        "flex min-h-[320px] items-center justify-center",
        variant === "loading" ? "flex-col gap-3" : "",
        className,
      )}
    >
      {variant === "loading" && (
        <span
          aria-hidden
          className="h-5 w-5 animate-spin rounded-full border-2 border-gray-04 border-t-transparent"
        />
      )}
      <p
        className={cn(
          "typo-body-02-regular",
          variant === "error" ? "text-red-01" : "text-gray-04",
        )}
      >
        {resolvedMessage}
      </p>
    </div>
  );
}
