"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * Option (디자인 시스템 Option 156:3049)
 * Figma: default(156-3045), checked(156-3044), disabled(3110-160)
 * - row, items-center, gap 10px, 아이콘 19x19 + 텍스트 typo-body-02-regular
 */
const optionItemVariants = cva(
  "inline-flex items-center gap-2.5 text-left typo-body-02-regular text-gray-01",
  {
    variants: {
      variant: {
        /** default: 원형 아웃라인 wgray-04, 텍스트 gray-01 */
        default: "",
        /** checked: 체크 아이콘 main-02, 텍스트 gray-01 */
        checked: "",
        /** disabled: 원형 bg gray-08, 텍스트 gray-04 */
        disabled: "cursor-not-allowed text-gray-04",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface OptionItemProps
  extends VariantProps<typeof optionItemVariants> {
  /** 선택지 라벨 (예: "텍스트 선택지") */
  children: React.ReactNode;
  /** 클릭 핸들러 (disabled일 때는 무시) */
  onClick?: () => void;
  className?: string;
  /** 버튼으로 쓸지 여부 (true면 button, false면 div) */
  asButton?: boolean;
}

export function OptionItem({
  variant = "default",
  children,
  onClick,
  className,
  asButton = true,
}: OptionItemProps) {
  const content = (
    <>
      {variant === "checked" && <CheckedIcon />}
      {variant === "default" && <DefaultIcon />}
      {variant === "disabled" && <DisabledIcon />}
      <span>{children}</span>
    </>
  );

  const commonClassName = cn(optionItemVariants({ variant }), className);

  if (asButton && variant !== "disabled") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("cursor-pointer", commonClassName)}
      >
        {content}
      </button>
    );
  }

  return <div className={commonClassName}>{content}</div>;
}
OptionItem.displayName = "OptionItem";

function DefaultIcon() {
  return (
    <svg
      className="h-[19px] w-[19px] shrink-0"
      viewBox="0 0 19 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="9.5" cy="9.5" r="8" className="stroke-wgray-04" />
    </svg>
  );
}

function CheckedIcon() {
  return (
    <svg
      className="h-[19px] w-[19px] shrink-0 text-main-02"
      viewBox="0 0 19 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 9.5l3.5 3.5L15 5" />
    </svg>
  );
}

function DisabledIcon() {
  return (
    <svg
      className="h-[19px] w-[19px] shrink-0"
      viewBox="0 0 19 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <circle cx="9.5" cy="9.5" r="8" className="fill-gray-08 stroke-wgray-04" />
    </svg>
  );
}
