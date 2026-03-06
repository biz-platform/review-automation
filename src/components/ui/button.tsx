"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 rounded-lg font-medium outline outline-1 outline-offset-[-1px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-main-02 text-white outline-main-02 [&:not(:disabled)]:hover:opacity-90",
        secondary:
          "bg-gray-08 text-gray-02 outline-gray-07 disabled:text-gray-06 [&:not(:disabled)]:hover:bg-gray-07",
        secondaryDark:
          "bg-wgray-02 text-white outline-wgray-01 [&:not(:disabled)]:hover:opacity-90",
        destructive:
          "bg-red-01 text-white outline-red-01 [&:not(:disabled)]:hover:opacity-90",
        ghost:
          "bg-transparent outline-transparent [&:not(:disabled)]:hover:bg-muted [&:not(:disabled)]:hover:outline-gray-07",
      },
      size: {
        sm: "h-8 px-3 py-2 text-xs",
        md: "h-9 px-3 py-2 text-sm",
        lg: "h-12 p-4 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
