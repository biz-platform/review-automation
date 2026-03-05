"use client";

import { Card } from "@/components/ui/card";
import { PLATFORM_LABEL } from "@/const/platform";
import type { ReviewData } from "@/entities/review/types";

export interface ReviewListCardProps {
  review: ReviewData;
  onOpenImages: (images: { imageUrl: string }[], index: number) => void;
}

export function ReviewListCard({ review, onOpenImages }: ReviewListCardProps) {
  return (
    <li>
      <Card padding="md">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {PLATFORM_LABEL[review.platform] ?? review.platform}
          </span>
          {review.rating != null && (
            <span className="text-sm font-medium">{review.rating}점</span>
          )}
        </div>
        {review.menus && review.menus.length > 0 && (
          <p className="mb-1 text-xs text-muted-foreground">
            {review.menus.join(", ")}
          </p>
        )}
        <p className="mb-2 whitespace-pre-wrap">
          {review.content ?? "(내용 없음)"}
        </p>
        {review.images && review.images.length > 0 && (
          <div className="mb-2 flex gap-1">
            {review.images.slice(0, 3).map((img, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onOpenImages(review.images!, i)}
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
      </Card>
    </li>
  );
}
