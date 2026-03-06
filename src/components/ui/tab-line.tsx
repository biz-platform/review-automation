"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * TabLine (상단탭 스타일)
 * - PC: typo-heading-02-bold, px-5(아이콘 없음)/px-4(아이콘 있음), gap-3.5
 * - Mobile: typo-body-01-bold, px-3/px-2, gap-1.5
 * - active: text gray-01, 하단 라인 h-0.5 bg-gray-01
 * - inactive: text gray-06, 하단 라인 h-px bg-gray-07
 * - icon은 별도 제공 예정 → items[].icon 슬롯
 */
const tabLineRootVariants = cva(
  "inline-flex flex-col justify-start items-center",
  {
    variants: {
      size: {
        pc: "gap-3.5",
        mobile: "gap-1.5",
      },
    },
    defaultVariants: {
      size: "pc",
    },
  }
);

const tabLineTriggerVariants = cva(
  "inline-flex justify-center items-center gap-2.5 text-center transition-colors",
  {
    variants: {
      size: {
        pc: "typo-heading-02-bold",
        mobile: "typo-body-01-bold",
      },
      selected: {
        true: "text-gray-01",
        false: "text-gray-06",
      },
      hasIcon: {
        true: "h-5",
        false: "",
      },
    },
    compoundVariants: [
      { size: "pc", hasIcon: false, class: "px-5" },
      { size: "pc", hasIcon: true, class: "px-4" },
      { size: "mobile", hasIcon: false, class: "px-3" },
      { size: "mobile", hasIcon: true, class: "px-2 gap-1.5" },
    ],
    defaultVariants: {
      size: "pc",
      selected: false,
      hasIcon: false,
    },
  }
);

export interface TabLineItemProps {
  value: string;
  label: string;
  /** 아이콘은 별도 제공 예정. 있으면 트리거 오른쪽에 렌더됨 */
  icon?: React.ReactNode;
}

export interface TabLineProps
  extends VariantProps<typeof tabLineRootVariants> {
  /** 탭 목록 */
  items: TabLineItemProps[];
  /** 현재 선택된 value */
  value: string;
  /** 탭 클릭 시 (value 전달) */
  onValueChange: (value: string) => void;
  /** 래퍼 클래스 */
  className?: string;
  /** 개별 탭 트리거에 추가할 클래스 */
  triggerClassName?: string;
}

export function TabLine({
  items,
  value,
  onValueChange,
  size = "pc",
  className,
  triggerClassName,
}: TabLineProps) {
  return (
    <div
      className={cn(tabLineRootVariants({ size }), className)}
      role="tablist"
    >
      {items.map((item) => {
        const selected = value === item.value;
        const hasIcon = item.icon != null;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onValueChange(item.value)}
            className="inline-flex flex-col justify-start items-center w-full"
          >
            <span
              className={cn(
                tabLineTriggerVariants({ size, selected, hasIcon }),
                triggerClassName
              )}
            >
              <span>{item.label}</span>
              {item.icon != null && (
                <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">
                  {item.icon}
                </span>
              )}
            </span>
            <span
              className={cn(
                "self-stretch w-full",
                selected ? "h-0.5 bg-gray-01" : "h-px bg-gray-07"
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
TabLine.displayName = "TabLine";
