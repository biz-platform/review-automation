"use client";

import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import { useReviewList } from "@/entities/review/hooks/query/use-review-list";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useState } from "react";

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  baemin: "배민",
  yogiyo: "요기요",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
};

export default function ReviewsPage() {
  const { data: stores } = useStoreList();
  const [storeId, setStoreId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [imageModal, setImageModal] = useState<{ images: { imageUrl: string }[]; index: number } | null>(null);
  const { data, isLoading } = useReviewList({
    store_id: storeId || undefined,
    platform: platform || undefined,
    limit: 20,
    offset: 0,
  });

  const list = data?.result ?? [];
  const count = data?.count ?? 0;

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">리뷰 목록</h1>
      <div className="mb-6 flex flex-wrap gap-4">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">매장</span>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          >
            <option value="">전체</option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">플랫폼</span>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="rounded-md border border-border px-3 py-2"
          >
            <option value="">전체</option>
            {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {isLoading && <p className="text-muted-foreground">로딩 중…</p>}
      <ul className="space-y-2">
        {list.map((review) => (
          <li key={review.id} className="rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {PLATFORM_LABEL[review.platform] ?? review.platform}
              </span>
              {review.rating != null && (
                <span className="text-sm font-medium">{review.rating}점</span>
              )}
            </div>
            <p className="mb-2 whitespace-pre-wrap">
              {review.content ?? "(내용 없음)"}
            </p>
            {review.images && review.images.length > 0 && (
              <div className="mb-2 flex gap-1">
                {review.images.slice(0, 3).map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setImageModal({ images: review.images!, index: i })}
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
          </li>
        ))}
      </ul>
      {!isLoading && list.length === 0 && (
        <p className="text-muted-foreground">리뷰가 없습니다.</p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">총 {count}건</p>
      {imageModal && (
        <ReviewImageModal
          images={imageModal.images}
          initialIndex={imageModal.index}
          onClose={() => setImageModal(null)}
        />
      )}
    </div>
  );
}
