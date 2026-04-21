"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptionItem } from "@/components/ui/option-item";
import { Modal } from "@/components/ui/modal";
import { ReplyStatusBadge } from "@/components/review/ReplyStatusBadge";
import { ReplyContentBlock } from "@/components/review/ReplyContentBlock";
import { cn } from "@/lib/utils/cn";
import type { ReviewData } from "@/entities/review/types";
import type { ReplyContentBlockProps } from "@/components/review/ReplyContentBlock";

/** 이 길이 초과 시 카드에서는 잘라서 표시하고 "더보기" 노출 */
const REVIEW_CONTENT_TRUNCATE_LEN = 120;

const PLATFORM_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  baemin: { bg: "bg-[#DFFFFE]", text: "text-[#007D88]" },
  coupang_eats: { bg: "bg-blue-03", text: "text-blue-01" },
  yogiyo: { bg: "bg-[#FFE5E5]", text: "text-[#C60000]" },
  ddangyo: { bg: "bg-[#FEEEE5]", text: "text-[#EA5E00]" },
};

export interface ReviewManageCardProps {
  review: ReviewData;
  /** 헤더에 표시할 라벨 (예: author_name 또는 플랫폼명) */
  headerLabel: string;
  onOpenImages: (images: { imageUrl: string }[], index: number) => void;
  replyBlockProps: ReplyContentBlockProps;
  /** 플랫폼|매장 배지용 (예: "쿠팡이츠 | 히떼로스터리 광안점") */
  platformStoreLabel?: string;
  /** 개별 선택 체크박스: 미등록만 활성화, 등록완료/기한만료는 비활성화 */
  showCheckbox?: boolean;
  checked?: boolean;
  checkboxDisabled?: boolean;
  onCheckboxToggle?: () => void;
}

export function ReviewManageCard({
  review,
  headerLabel,
  onOpenImages,
  replyBlockProps,
  platformStoreLabel,
  showCheckbox,
  checked,
  checkboxDisabled,
  onCheckboxToggle,
}: ReviewManageCardProps) {
  const [reviewFullModalOpen, setReviewFullModalOpen] = useState(false);
  const reviewContent = review.content ?? "(내용 없음)";
  const showReadMore = reviewContent.length > REVIEW_CONTENT_TRUNCATE_LEN;
  const isDdangyo = review.platform === "ddangyo";

  const ratingLabel = (() => {
    if (review.rating == null) return null;
    if (isDdangyo) {
      // ddangyo: "맛있어요" 단일 평가(= 5로 저장)
      return review.rating >= 5 ? "맛있어요 👍" : null;
    }
    return `${review.rating}점`;
  })();

  const ratingStars = (() => {
    if (review.rating == null) return null;
    if (isDdangyo) return null;
    return "★".repeat(Math.round(review.rating));
  })();

  return (
    <li>
      <Card
        padding="md"
        className="rounded-xl border-gray-07 bg-white p-5 shadow-sm"
      >
        {/* 선택 시 카드 전체 bg-main-05, AI 추천 댓글 카드 내부만 제외 */}
        <div
          className={cn(
            checked && "rounded-xl -mx-5 -my-5 px-5 py-5 bg-main-05",
          )}
        >
          {/* 상단: 상태 배지 + 플랫폼|매장 배지 (Figma: pill) */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <ReplyStatusBadge
              platformReplyContent={review.platform_reply_content ?? null}
              platformOperatorReplyContent={
                review.platform_operator_reply_content ?? null
              }
              writtenAt={review.written_at ?? null}
              platform={review.platform}
            />
            {platformStoreLabel && (
              <Badge
                variant="default"
                className={cn(
                  "rounded-full px-3.5 py-2",
                  PLATFORM_BADGE_STYLES[review.platform]
                    ? `${PLATFORM_BADGE_STYLES[review.platform].bg} ${PLATFORM_BADGE_STYLES[review.platform].text}`
                    : "bg-gray-07 text-gray-01",
                )}
              >
                {platformStoreLabel}
              </Badge>
            )}
          </div>
          {showCheckbox ? (
            <div className="mb-3 flex items-start">
              <OptionItem
                variant={
                  checkboxDisabled
                    ? "disabled"
                    : checked
                      ? "checked"
                      : "default"
                }
                onClick={checkboxDisabled ? undefined : onCheckboxToggle}
                className="shrink-0 pt-0.5"
              />
              <div className="min-w-0 flex-1 pl-3">
                <p className="typo-body-01-bold mb-3.5 text-gray-01">
                  {review.author_name}
                </p>
                {/* 별점 + 구분선 + 작성일 (들여쓰기 블록 내) */}
                <div className="mb-2 flex flex-wrap items-center gap-2 typo-body-02-regular">
                  {ratingLabel != null && (
                    <>
                      <span className="font-medium text-gray-01">{ratingLabel}</span>
                      {ratingStars != null && (
                        <span className="text-yellow-500" aria-hidden>
                          {ratingStars}
                        </span>
                      )}
                    </>
                  )}
                  {ratingLabel != null && review.written_at != null && (
                    <span
                      className="h-4 w-px shrink-0 bg-gray-07"
                      aria-hidden
                    />
                  )}
                  {review.written_at != null && (
                    <span className="text-gray-04">
                      {review.written_at.slice(0, 10).replace(/-/g, ".")}
                    </span>
                  )}
                </div>
                {review.menus && review.menus.length > 0 && (
                  <p className="typo-body-02-regular mb-3 text-gray-03">
                    {review.menus.join(", ")}
                  </p>
                )}
                <div className="mb-4">
                  <p
                    className={cn(
                      "typo-body-02-regular whitespace-pre-wrap leading-relaxed text-gray-01",
                      showReadMore && "line-clamp-3",
                    )}
                  >
                    {showReadMore
                      ? reviewContent.slice(0, REVIEW_CONTENT_TRUNCATE_LEN) +
                        "…"
                      : reviewContent}
                  </p>
                  {showReadMore && (
                    <button
                      type="button"
                      onClick={() => setReviewFullModalOpen(true)}
                      className="typo-body-03-regular mt-1 text-main-02 underline underline-offset-2"
                    >
                      더보기
                    </button>
                  )}
                </div>
                {review.images && review.images.length > 0 && (
                  <div className="mb-4 flex gap-2">
                    {review.images.slice(0, 3).map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          onOpenImages(review.images!, i);
                        }}
                        className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-gray-07 transition hover:opacity-90"
                      >
                        <img
                          src={img.imageUrl}
                          alt=""
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      </button>
                    ))}
                    {review.images.length > 3 && (
                      <span className="typo-body-03-regular flex items-center text-gray-04">
                        +{review.images.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 체크박스 없을 때: 작성자명 없이 별점부터 */}
              <div className="mb-3 flex flex-wrap items-center gap-2 typo-body-02-regular">
                {ratingLabel != null && (
                  <>
                    <span className="font-medium text-gray-01">{ratingLabel}</span>
                    {ratingStars != null && (
                      <span className="text-yellow-500" aria-hidden>
                        {ratingStars}
                      </span>
                    )}
                  </>
                )}
                {ratingLabel != null && review.written_at != null && (
                  <span className="h-4 w-px shrink-0 bg-gray-07" aria-hidden />
                )}
                {review.written_at != null && (
                  <span className="text-gray-04">
                    {review.written_at.slice(0, 10).replace(/-/g, ".")}
                  </span>
                )}
              </div>
              {review.menus && review.menus.length > 0 && (
                <p className="typo-body-02-regular mb-3 text-gray-03">
                  {review.menus.join(", ")}
                </p>
              )}
              <div className="mb-3">
                <p
                  className={cn(
                    "typo-body-02-regular whitespace-pre-wrap leading-relaxed text-gray-01",
                    showReadMore && "line-clamp-3",
                  )}
                >
                  {showReadMore
                    ? reviewContent.slice(0, REVIEW_CONTENT_TRUNCATE_LEN) + "…"
                    : reviewContent}
                </p>
                {showReadMore && (
                  <button
                    type="button"
                    onClick={() => setReviewFullModalOpen(true)}
                    className="typo-body-03-regular mt-1 text-main-02 underline underline-offset-2"
                  >
                    더보기
                  </button>
                )}
              </div>
              {review.images && review.images.length > 0 && (
                <div className="mb-4 flex gap-2">
                  {review.images.slice(0, 3).map((img, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onOpenImages(review.images!, i);
                      }}
                      className="h-14 w-14 shrink-0 cursor-pointer rounded-lg border border-gray-07 transition hover:opacity-90"
                    >
                      <img
                        src={img.imageUrl}
                        alt=""
                        className="h-14 w-14 rounded-lg object-cover"
                      />
                    </button>
                  ))}
                  {review.images.length > 3 && (
                    <span className="typo-body-03-regular flex items-center text-gray-04">
                      +{review.images.length - 3}
                    </span>
                  )}
                </div>
              )}
            </>
          )}
          {/* AI 추천 댓글: 내부 카드만 bg-white, 주변은 selected 시 main-05 */}
          <div className={cn(checked && "mt-4")}>
            <ReplyContentBlock {...replyBlockProps} />
          </div>
        </div>
      </Card>
      <Modal
        open={reviewFullModalOpen}
        onOpenChange={(open) => !open && setReviewFullModalOpen(false)}
        title="리뷰 내용"
        footer={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setReviewFullModalOpen(false)}
          >
            닫기
          </Button>
        }
      >
        <p className="max-h-60 overflow-y-auto whitespace-pre-wrap typo-body-02-regular leading-relaxed text-gray-01">
          {reviewContent}
        </p>
      </Modal>
    </li>
  );
}
