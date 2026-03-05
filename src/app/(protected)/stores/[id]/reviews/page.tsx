"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import { useReviewList } from "@/entities/review/hooks/query/use-review-list";
import { useStore } from "@/entities/store/hooks/query/use-store";
import { useCollectStoreReviews } from "@/entities/store/hooks/mutation/use-collect-store-reviews";
import { Button } from "@/components/ui/button";
import { ReviewListCard } from "@/components/review/ReviewListCard";

export default function StoreReviewsPage() {
  const params = useParams();
  const storeId = params.id as string;
  const [imageModal, setImageModal] = useState<{
    images: { imageUrl: string }[];
    index: number;
  } | null>(null);
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
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            collectStore.mutate({ storeId }, { onSuccess: () => refetch() })
          }
          disabled={collectStore.isPending}
        >
          {collectStore.isPending ? "수집 중…" : "수집 (Mock)"}
        </Button>
      </div>
      <ul className="space-y-2">
        {list.map((review) => (
          <ReviewListCard
            key={review.id}
            review={review}
            onOpenImages={(images, index) =>
              setImageModal({ images, index })
            }
          />
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
