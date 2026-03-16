"use client";

import { TabLine } from "@/components/ui/tab-line";
import type { TabLineItemProps } from "@/components/ui/tab-line";

export interface ManageSectionTabLineProps {
  /** 데스크톱 탭 아이템 */
  items: TabLineItemProps[];
  /** 모바일 탭 아이템 (없으면 items 사용) */
  itemsMobile?: TabLineItemProps[];
  value: string;
  onValueChange: (value: string) => void;
}

/**
 * 댓글 관리 / AI 댓글 설정 / 매장 관리 공통 TabLine 래퍼.
 * 스타일·구조·간격 통일 (breakout-appshell, 모바일/데스크 구조 동일).
 */
export function ManageSectionTabLine({
  items,
  itemsMobile,
  value,
  onValueChange,
}: ManageSectionTabLineProps) {
  const mobileItems = itemsMobile ?? items;

  return (
    <div className="breakout-appshell scrollbar-hide">
      <div className="w-full lg:hidden">
        <TabLine
          items={mobileItems}
          value={value}
          onValueChange={onValueChange}
          direction="row"
          size="mobile"
        />
      </div>
      <TabLine
        items={items}
        value={value}
        onValueChange={onValueChange}
        direction="row"
        size="pc"
        className="hidden lg:inline-flex"
      />
    </div>
  );
}
