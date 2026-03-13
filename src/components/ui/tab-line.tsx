"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * TabLine (상단탭 스타일)
 * 댓글 관리 / AI 댓글 설정 / 매장 관리에서 통일된 스타일 적용.
 * - PC: typo-heading-02-bold, px-5, gap-3.5
 * - Mobile: typo-body-01-bold, px-3, gap-1.5
 * - active: text gray-01, 하단 굵은 라인
 * - inactive: text gray-06
 */
const tabLineRootVariants = cva(
  "inline-flex justify-start items-center border-b border-gray-07",
  {
    variants: {
      direction: {
        row: "flex-row",
        column: "flex-col",
      },
      size: {
        pc: "gap-3.5",
        mobile: "gap-1.5 flex-nowrap",
      },
    },
    defaultVariants: {
      direction: "row",
      size: "pc",
    },
  }
);

const tabLineTriggerVariants = cva(
  "inline-flex justify-center items-center gap-2.5 text-center transition-colors",
  {
    variants: {
      size: {
        pc: "typo-heading-02-bold px-5",
        mobile: "typo-body-01-bold px-3",
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
  direction = "row",
  size = "pc",
  className,
  triggerClassName,
}: TabLineProps) {
  const isMobile = size === "mobile";
  const rootClasses = cn(
    tabLineRootVariants({ direction, size }),
    className
  );

  const content = (
    <div className={rootClasses} role="tablist">
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
            className={cn(
              "inline-flex flex-col justify-start items-center pb-3 pt-1",
              isMobile ? "min-h-10 shrink-0" : "min-h-11 w-full",
              selected && "border-b-2 border-gray-01 -mb-px"
            )}
          >
            <span
              className={cn(
                tabLineTriggerVariants({ size, selected, hasIcon }),
                triggerClassName
              )}
            >
              <span className="whitespace-nowrap">{item.label}</span>
              {item.icon != null && (
                <span className="shrink-0 [&>svg]:h-5 [&>svg]:w-5">
                  {item.icon}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (isMobile) {
    return (
      <div className="scrollbar-hide w-full max-w-full overflow-x-auto overflow-y-hidden">
        {content}
      </div>
    );
  }

  return content;
}
TabLine.displayName = "TabLine";
