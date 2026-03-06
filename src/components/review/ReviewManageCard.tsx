"use client";

import { Card } from "@/components/ui/card";
import { ReplyStatusBadge } from "@/components/review/ReplyStatusBadge";
import { ReplyContentBlock } from "@/components/review/ReplyContentBlock";
import type { ReviewData } from "@/entities/review/types";
import type { ReplyContentBlockProps } from "@/components/review/ReplyContentBlock";

export interface ReviewManageCardProps {
  review: ReviewData;
  /** 헤더에 표시할 라벨 (예: author_name 또는 플랫폼명) */
  headerLabel: string;
  onOpenImages: (images: { imageUrl: string }[], index: number) => void;
  replyBlockProps: ReplyContentBlockProps;
}

export function ReviewManageCard({
  review,
  headerLabel,
  onOpenImages,
  replyBlockProps,
}: ReviewManageCardProps) {
  return (
    <li>
      <Card padding="md">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {review.rating != null && (
            <span className="text-sm font-medium">{review.rating}점</span>
          )}
          <span className="text-sm text-muted-foreground">{headerLabel}</span>
          {review.written_at != null && (
            <span className="text-xs text-muted-foreground">
              {review.written_at.slice(0, 10)}
            </span>
          )}
          <ReplyStatusBadge
            platformReplyContent={review.platform_reply_content ?? null}
            writtenAt={review.written_at ?? null}
            platform={review.platform}
          />
        </div>
        {review.menus && review.menus.length > 0 && (
          <p className="mb-1 text-xs text-muted-foreground">
            {review.menus.join(", ")}
          </p>
        )}
        <p className="whitespace-pre-wrap">
          {review.content ?? "(내용 없음)"}
        </p>
        {review.images && review.images.length > 0 && (
          <div className="mt-2 flex gap-1">
            {review.images.slice(0, 3).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenImages(review.images!, i);
                }}
                className="cursor-pointer rounded border border-border transition hover:opacity-90"
              >
                <img
                  src={img.imageUrl}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              </button>
            ))}
            {review.images.length > 3 && (
              <span className="flex items-center text-xs text-muted-foreground">
                +{review.images.length - 3}
              </span>
            )}
          </div>
        )}
        <ReplyContentBlock {...replyBlockProps} />
      </Card>
    </li>
  );
}
