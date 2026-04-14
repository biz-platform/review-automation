"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const weekdayDemandBadgeVariants = cva(
  [
    // Figma: padding 2px 6px, radius 8px, stroke 1px, font 10 / 1.6em
    "inline-flex items-center justify-center gap-0.5",
    "rounded-[8px] border px-[6px] py-[2px]",
    "text-[10px] font-medium leading-[1.6] tabular-nums",
    "select-none whitespace-nowrap",
  ],
  {
    variants: {
      variant: {
        /** Figma node 749:9648 (Badge/여유) */
        chill: "bg-[#E0F1FF] border-[#0073CB] text-[#0073CB]",
        /** '인기'는 동일한 구조로 톤만 레드로 */
        popular: "bg-[#FFE7E7] border-[#D12B2B] text-[#D12B2B]",
      },
    },
    defaultVariants: { variant: "chill" },
  },
);

export type WeekdayDemandBadgeProps = VariantProps<
  typeof weekdayDemandBadgeVariants
> & {
  children: React.ReactNode;
  className?: string;
};

export function WeekdayDemandBadge({
  variant,
  children,
  className,
}: WeekdayDemandBadgeProps) {
  return (
    <span className={cn(weekdayDemandBadgeVariants({ variant }), className)}>
      {children}
    </span>
  );
}

