"use client";

import { useEffect } from "react";
import { TextField } from "@/components/ui/text-field";
import { AI_LENGTH_OPTIONS, MARKETING_TEXT_MAX_LENGTH } from "./constants";
import { cn } from "@/lib/utils/cn";

export interface MarketingTabProps {
  storeId: string;
  marketingText: string;
  onMarketingTextChange: (v: string) => void;
  length: string;
  onLengthChange: (v: string) => void;
}

/** 마케팅 탭: 마케팅 설정 텍스트(최대 100자). 저장은 상단 공통 하단 바 사용 */
export function MarketingTab({
  marketingText,
  onMarketingTextChange,
  length,
  onLengthChange,
}: MarketingTabProps) {
  const hasMarketingText = marketingText.trim().length > 0;

  useEffect(() => {
    if (hasMarketingText && length === "long") {
      onLengthChange("normal");
    }
  }, [hasMarketingText, length, onLengthChange]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="typo-heading-02-bold text-gray-01">댓글 마케팅</h1>
        <p className="typo-body-03-regular text-gray-04">
          리뷰 마지막에 공통으로 추가되는 문구로, 리뷰를 마케팅 창구처럼
          활용할 수 있어요
          <br />
          신메뉴 출시, 이벤트, 할인 소식 등 고객에게 알리고 싶은 내용을
          적어보세요
        </p>
      </div>
      <TextField
        label="마케팅 문구"
        placeholder="최대 100자까지 입력할 수 있어요. 예) 3월 한 달간 신메뉴 딸기라떼 30% 할인 중이에요"
        value={marketingText}
        onChange={(e) =>
          onMarketingTextChange(
            e.target.value.slice(0, MARKETING_TEXT_MAX_LENGTH),
          )
        }
        maxLength={MARKETING_TEXT_MAX_LENGTH}
        trailingAddon={
          <span
            className={cn(
              "typo-body-02-regular",
              marketingText.length >= MARKETING_TEXT_MAX_LENGTH
                ? "text-red-600"
                : "text-gray-05",
            )}
          >
            {marketingText.length}자
          </span>
        }
        className="mb-0"
      />
    </section>
  );
}
