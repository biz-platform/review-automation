"use client";

import { forwardRef, type ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";
import arrowDown from "@/assets/icons/24px/downarrow.webp";

/** `downarrow` + `gray-05` — 펼침 chevron·select 트리거 공통 */
export const maskedNativeSelectArrowMaskStyle = {
  maskImage: `url(${arrowDown.src})`,
  WebkitMaskImage: `url(${arrowDown.src})`,
  maskSize: "contain",
  WebkitMaskSize: "contain",
  maskRepeat: "no-repeat",
  WebkitMaskRepeat: "no-repeat",
  maskPosition: "center",
  WebkitMaskPosition: "center",
} as const;

export function MaskedNativeSelectArrow({
  className,
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none inline-block bg-gray-05",
        className,
      )}
      style={maskedNativeSelectArrowMaskStyle}
    />
  );
}

const triggerVariants = cva(
  "w-full cursor-pointer rounded-lg border border-gray-07 bg-white text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02 appearance-none [-webkit-appearance:none]",
  {
    variants: {
      uiSize: {
        sm: "h-10 min-h-10 pl-3 pr-10 typo-body-03-regular",
        md: "h-12 min-h-12 pl-4 pr-12 typo-body-02-regular",
      },
    },
    defaultVariants: { uiSize: "md" },
  },
);

const arrowVariants = cva(
  "pointer-events-none absolute top-1/2 -translate-y-1/2 bg-gray-05",
  {
    variants: {
      uiSize: {
        sm: "right-2.5 size-5",
        md: "right-3 size-6",
      },
    },
    defaultVariants: { uiSize: "md" },
  },
);

export type MaskedNativeSelectProps = Omit<
  ComponentProps<"select">,
  "size"
> &
  VariantProps<typeof triggerVariants> & {
    /** relative 래퍼 (너비·shrink 등) */
    wrapperClassName?: string;
  };

export const MaskedNativeSelect = forwardRef<
  HTMLSelectElement,
  MaskedNativeSelectProps
>(function MaskedNativeSelect(
  { className, uiSize, wrapperClassName, style, children, ...props },
  ref,
) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        {...props}
        className={cn(triggerVariants({ uiSize }), className)}
        style={style}
      >
        {children}
      </select>
      <MaskedNativeSelectArrow className={arrowVariants({ uiSize })} />
    </div>
  );
});
MaskedNativeSelect.displayName = "MaskedNativeSelect";
