"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import { useReviewList } from "@/entities/review/hooks/query/use-review-list";
import { useStore } from "@/entities/store/hooks/query/use-store";
import { useCollectStoreReviews } from "@/entities/store/hooks/mutation/use-collect-store-reviews";

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  baemin: "배민",
  yogiyo: "요기요",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
};

export default function StoreReviewsPage() {
  const params = useParams();
  const storeId = params.id as string;
  const [imageModal, setImageModal] = useState<{ images: { imageUrl: string }[]; index: number } | null>(null);
  const { data: store } = useStore(storeId);
  const { data, isLoading, error, refetch } = useReviewList({
    store_id: storeId,
  });
  const collectStore = useCollectStoreReviews();

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error) return <p className="p-8 text-red-600">오류: {String(error)}</p>;

  const list = data?.result ?? [];
  const count = data?.count ?? 0;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link
          href={`/stores/${storeId}`}
          className="text-muted-foreground hover:underline"
        >
          ← {store?.name ?? "매장"}
        </Link>
      </div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">리뷰 목록</h1>
        <button
          type="button"
          onClick={() =>
            collectStore.mutate({ storeId }, { onSuccess: () => refetch() })
          }
          disabled={collectStore.isPending}
          className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
        >
          {collectStore.isPending ? "수집 중…" : "수집 (Mock)"}
        </button>
      </div>
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
            <p className="mb-2 line-clamp-2">
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
            <Link
              href={`/reviews/${review.id}`}
              className="text-sm text-primary hover:underline"
            >
              상세 보기
            </Link>
          </li>
        ))}
      </ul>
      {imageModal && (
        <ReviewImageModal
          images={imageModal.images}
          initialIndex={imageModal.index}
          onClose={() => setImageModal(null)}
        />
      )}
      {list.length === 0 && (
        <p className="text-muted-foreground">
          리뷰가 없습니다. 수집 버튼으로 목데이터를 추가할 수 있습니다.
        </p>
      )}
      <p className="mt-4 text-sm text-muted-foreground">총 {count}건</p>
    </div>
  );
}
