"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/** Tag 스타일 선택 버튼 (export: TagSelect). 파일명은 tag-button 유지. */
const tagSelectVariants = cva(
  "inline-flex items-center justify-center gap-2.5 rounded-[20px] outline outline-1 outline-offset-[-1px] typo-body-03-regular transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        /** default: border wgray-04, bg white */
        default:
          "bg-white text-gray-01 outline-wgray-04 [&:not(:disabled)]:hover:bg-gray-08",
        /** checked: border gray-02, bg gray-03 */
        checked:
          "bg-gray-03 text-white typo-body-03-bold outline-gray-02 [&:not(:disabled)]:hover:opacity-90",
        /** disabled: border wgray-04, bg wgray-06 */
        disabled:
          "bg-wgray-06 text-gray-06 outline-wgray-04 cursor-not-allowed",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface TagSelectProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tagSelectVariants> {}

export const TagSelect = forwardRef<HTMLButtonElement, TagSelectProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "h-9 px-3 py-2.5",
          tagSelectVariants({ variant, className }),
        )}
        {...props}
      />
    );
  },
);
TagSelect.displayName = "TagSelect";
