"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Navigation (디자인 시스템 3057:267)
 * - structure: text(라벨만) | icon_parent | icon_child
 * - state: default | hover | selected (icon 계열만)
 * - row, items-center, gap 12px, icon 24px, padding·색상 스펙 준수
 */
const navItemVariants = cva(
  "flex w-full items-center gap-3 py-3 transition-colors",
  {
    variants: {
      structure: {
        /** 라벨만: pl-[18px], typo-body-02-bold text-gray-05 */
        text: "pl-[18px] typo-body-02-bold text-gray-05",
        /** 아이콘+텍스트, 부모 레벨: pl-[18px] */
        icon_parent: "pl-[18px] typo-body-01-bold text-gray-03 rounded-lg",
        /** 아이콘+텍스트, 자식 레벨: pl-[30px] */
        icon_child: "pl-[30px] typo-body-01-bold text-gray-03 rounded-lg",
      },
      state: {
        default: "",
        hover: "bg-gray-08",
        selected: "bg-main-04 text-gray-01",
      },
    },
    compoundVariants: [
      { structure: "text", state: "hover", className: "bg-transparent" },
      { structure: "text", state: "selected", className: "bg-transparent text-gray-05" },
      { structure: "icon_parent", state: "default", className: "hover:bg-gray-08" },
      { structure: "icon_child", state: "default", className: "hover:bg-gray-08" },
    ],
    defaultVariants: {
      structure: "icon_parent",
      state: "default",
    },
  }
);

export interface NavItemProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children">,
    VariantProps<typeof navItemVariants> {
  /** 아이콘 (structure가 icon_parent | icon_child일 때, 24x24 권장) */
  icon?: React.ReactNode;
  /** 라벨 텍스트 */
  children: React.ReactNode;
}

const NavItem = forwardRef<HTMLAnchorElement, NavItemProps>(
  (
    {
      structure = "icon_parent",
      state = "default",
      icon,
      children,
      className,
      ...props
    },
    ref
  ) => {
    const isInteractive = structure !== "text" && (props.href ?? props.onClick != null);
    const effectiveState = structure === "text" ? "default" : state;

    return (
      <a
        ref={ref}
        className={cn(
          navItemVariants({ structure, state: effectiveState }),
          isInteractive && "cursor-pointer",
          className
        )}
        {...props}
      >
        {(structure === "icon_parent" || structure === "icon_child") && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
            {icon}
          </span>
        )}
        <span>{children}</span>
      </a>
    );
  }
);
NavItem.displayName = "NavItem";

export { NavItem, navItemVariants };
