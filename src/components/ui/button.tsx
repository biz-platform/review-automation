"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 rounded-lg outline outline-1 outline-offset-[-1px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none",
  {
    variants: {
      variant: {
        primary:
          "bg-main-02 text-white outline-main-02 disabled:bg-wgray-06 disabled:text-gray-06 disabled:outline-wgray-04 [&:not(:disabled)]:hover:opacity-90",
        secondary:
          "bg-gray-08 text-gray-02 outline-gray-07 disabled:bg-wgray-06 disabled:text-gray-06 disabled:outline-wgray-04 [&:not(:disabled)]:hover:bg-gray-07",
        secondaryDark:
          "bg-wgray-02 text-white outline-wgray-01 disabled:bg-wgray-06 disabled:text-gray-06 disabled:outline-wgray-04 [&:not(:disabled)]:hover:bg-wgray-01",
        destructive:
          "bg-red-01 text-white outline-red-01 disabled:bg-wgray-06 disabled:text-gray-06 disabled:outline-wgray-04 [&:not(:disabled)]:hover:opacity-90",
        ghost:
          "bg-gray-08 text-gray-01 outline-gray-07 disabled:bg-wgray-06 disabled:text-gray-06 disabled:outline-wgray-04 [&:not(:disabled)]:hover:bg-gray-07 [&:not(:disabled)]:hover:outline-gray-07",
        /** 셀러 신청 모달용: 미입력 시 비활성 스타일(wgray-06/gray-06), 입력 완료 시 primary로 전환하려면 페이지에서 variant를 primary로 바꿔 쓸 것 */
        sellerApplyIncomplete:
          "bg-wgray-06 text-gray-06 outline-wgray-04 [&:not(:disabled)]:hover:opacity-90",
      },
      size: {
        sm: "min-w-0 px-3 py-2 typo-body-03-bold",
        md: "min-w-0 px-3 py-2 typo-body-02-bold",
        lg: "min-w-0 p-4 typo-body-01-bold",
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

export interface ButtonLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">,
    VariantProps<typeof buttonVariants> {
  href: string;
  children: React.ReactNode;
}

export const ButtonLink = forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  ({ href, className, variant, size, fullWidth, children, ...props }, ref) => (
    <Link
      ref={ref}
      href={href}
      className={cn(buttonVariants({ variant, size, fullWidth, className }))}
      {...props}
    >
      {children}
    </Link>
  )
);
ButtonLink.displayName = "ButtonLink";
