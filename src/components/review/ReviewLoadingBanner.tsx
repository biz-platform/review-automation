"use client";

import { Icon24 } from "@/components/ui/Icon24";
import documentIcon from "@/assets/icons/36px/document.webp";

/**
 * 최초 매장 연동 직후 또는 리뷰 동기화 중일 때 표시하는 안내 배너.
 * 데스크톱: 가로형 배너 (첨부이미지 1)
 * 모바일: 카드형 배너 (첨부이미지 3)
 */
export function ReviewLoadingBanner() {
  const primaryText = "새로 연동된 매장의 리뷰를 불러오고 있어요";
  const secondaryText =
    "최초 리뷰 수집에는 최대 1시간 정도 소요돼요. 1시간이 지나도 리뷰가 보이지 않으면 고객센터로 문의해주세요.";

  return (
    <div
      className="flex w-full items-start gap-3 rounded-xl bg-[#faf8f5] px-4 py-4 md:flex-row md:items-center md:gap-4 md:px-5 md:py-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center md:h-9 md:w-9">
        <Icon24
          src={documentIcon}
          alt=""
          pixelSize={36}
          className="h-9 w-9 md:h-8 md:w-8"
        />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <p className="typo-body-02-bold text-gray-01 md:typo-body-01-regular">
          {primaryText}
        </p>
        <p className="typo-body-03-regular text-gray-04 whitespace-pre-line">
          {secondaryText}
        </p>
      </div>
    </div>
  );
}
