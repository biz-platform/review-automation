"use client";

import { useState } from "react";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import { useReviewList } from "@/entities/review/hooks/query/use-review-list";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { PLATFORM_LABEL } from "@/const/platform";
import { ReviewListCard } from "@/components/review/ReviewListCard";
import { ContentStateMessage } from "@/components/ui/content-state-message";

export default function ReviewsListPage() {
  const { data: stores } = useStoreList();
  const [storeId, setStoreId] = useState<string>("");
  const [platform, setPlatform] = useState<string>("");
  const [imageModal, setImageModal] = useState<{
    images: { imageUrl: string }[];
    index: number;
  } | null>(null);
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
          <MaskedNativeSelect
            uiSize="sm"
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            wrapperClassName="min-w-[160px]"
          >
            <option value="">전체</option>
            {(stores ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </MaskedNativeSelect>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">플랫폼</span>
          <MaskedNativeSelect
            uiSize="sm"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            wrapperClassName="min-w-[140px]"
          >
            <option value="">전체</option>
            {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </MaskedNativeSelect>
        </label>
      </div>
      {isLoading && (
        <ContentStateMessage
          variant="loading"
          message="로딩 중…"
          className="min-h-40"
        />
      )}
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
