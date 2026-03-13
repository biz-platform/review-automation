"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("rounded px-2 py-0.5 typo-body-03-bold", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      success:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      warning:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      expired: "bg-muted text-muted-foreground",
      /** 댓글 관리: 미답변 — secondaryDark */
      reviewUnanswered: "bg-gray-03 text-white",
      /** 댓글 관리: 답변완료 — secondaryDark + opacity 50 */
      reviewAnswered: "bg-gray-03/50 text-white",
      /** 댓글 관리: 기한 만료 — red-02 + opacity 50 */
      reviewExpired: "bg-red-02/50 text-white",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
