"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import { PLATFORM_TABS, PLATFORM_LABEL } from "@/const/platform";
import { ReviewManageCard } from "@/components/review/ReviewManageCard";
import { SyncBar } from "@/components/review/SyncBar";
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { TabLine } from "@/components/ui/tab-line";
import { useReviewsManageState } from "./use-reviews-manage-state";
import { REVIEW_FILTER_TABS } from "./constants";

const REVIEWS_BASE = "/manage/reviews";

export default function ReviewsPage() {
  const router = useRouter();
  const state = useReviewsManageState();
  const {
    platform,
    effectiveFilter,
    linkedOnly,
    accountsLink,
    linkedStores,
    selectedStoreId,
    setSelectedStoreId,
    effectiveStoreId,
    showLinkPrompt,
    isBaemin,
    imageModal,
    setImageModal,
    baeminDbList,
    countAll,
    baeminListLoading,
    hasNextBaemin,
    isFetchingNextBaemin,
    list,
    count,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    isSyncing,
    isSyncingDdangyo,
    isSyncingYogiyo,
    isSyncingCoupangEats,
    handleSyncBaemin,
    handleSyncDdangyo,
    handleSyncYogiyo,
    handleSyncCoupangEats,
    sentinelRef,
    getReplyBlockProps,
  } = state;

  const openImages = (images: { imageUrl: string }[], index: number) => {
    setImageModal({ images, index });
  };

  const headerLabelFor = (review: {
    platform: string;
    author_name: string | null;
  }) => {
    if (
      (review.platform === "ddangyo" ||
        review.platform === "yogiyo" ||
        review.platform === "coupang_eats") &&
      review.author_name
    ) {
      return review.author_name;
    }
    return PLATFORM_LABEL[review.platform] ?? review.platform;
  };

  const platformHref = (tabValue: string) =>
    tabValue ? `${REVIEWS_BASE}?platform=${tabValue}` : REVIEWS_BASE;
  const filterHref = (filterValue: string) => {
    const base = platform
      ? `${REVIEWS_BASE}?platform=${platform}`
      : REVIEWS_BASE;
    return filterValue === "all"
      ? base
      : `${base}${base.includes("?") ? "&" : "?"}filter=${filterValue}`;
  };

  return (
    <div className="flex flex-col">
      {/* 플랫폼 탭 (TabLine) */}
      <div className="mb-6">
        <TabLine
          items={PLATFORM_TABS.map((t) => ({
            value: t.value ?? "",
            label: t.label,
          }))}
          value={platform ?? ""}
          onValueChange={(value) => router.push(platformHref(value))}
          direction="row"
          size="pc"
        />
      </div>

      <h1 className="typo-heading-02-bold mb-2 text-gray-01">
        등록된 리뷰 목록
      </h1>
      <p className="typo-body-02-regular mb-6 text-gray-04">
        매 시간 최근 6개월 리뷰를 자동으로 불러와요. 댓글은 최근 30일 이내
        등록된 리뷰에만 작성할 수 있어요.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {REVIEW_FILTER_TABS.map((tab) => (
          <Link
            key={tab.value}
            href={filterHref(tab.value)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              effectiveFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {showLinkPrompt && (
        <div className="mb-6 rounded-lg border border-border bg-muted/50 p-6 text-center">
          <p className="mb-4 text-muted-foreground">
            배달의민족 연동된 매장이 없습니다.
          </p>
          <Link
            href={accountsLink}
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            매장 계정 연동하기
          </Link>
        </div>
      )}

      {(isBaemin ||
        platform === "ddangyo" ||
        platform === "yogiyo" ||
        platform === "coupang_eats") &&
        linkedStores.length > 0 && (
          <div className="mb-4 flex items-center gap-4">
            <label className="text-sm font-medium">연동 매장</label>
            <select
              value={effectiveStoreId ?? ""}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {linkedStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}

      {isBaemin && linkedStores.length > 0 && (
        <>
          <SyncBar
            count={countAll}
            onSync={handleSyncBaemin}
            isSyncing={isSyncing}
            syncingLabel="리뷰 동기화 중… (1~2분 소요)"
          />
          {baeminListLoading && (
            <p className="text-muted-foreground">리뷰 목록 로딩 중…</p>
          )}
          <ul className="space-y-2">
            {baeminDbList.map((review) => (
              <ReviewManageCard
                key={review.id}
                review={review}
                headerLabel={review.author_name ?? ""}
                onOpenImages={openImages}
                replyBlockProps={getReplyBlockProps(review)}
              />
            ))}
          </ul>
          <div ref={sentinelRef} className="h-4" aria-hidden />
          {isFetchingNextBaemin && (
            <p className="py-2 text-center text-sm text-muted-foreground">
              더 불러오는 중…
            </p>
          )}
          {!baeminListLoading && baeminDbList.length === 0 && (
            <p className="text-muted-foreground">
              저장된 리뷰가 없습니다. 위 &quot;리뷰 동기화&quot;를 눌러 배민에서
              가져오세요.
            </p>
          )}
        </>
      )}

      {platform === "ddangyo" && linkedStores.length > 0 && (
        <SyncBar
          count={count}
          onSync={handleSyncDdangyo}
          isSyncing={isSyncingDdangyo}
        />
      )}

      {platform === "yogiyo" && linkedStores.length > 0 && (
        <SyncBar
          count={count}
          onSync={handleSyncYogiyo}
          isSyncing={isSyncingYogiyo}
        />
      )}

      {platform === "coupang_eats" && linkedStores.length > 0 && (
        <SyncBar
          count={count}
          onSync={handleSyncCoupangEats}
          isSyncing={isSyncingCoupangEats}
        />
      )}

      {!isBaemin && !showLinkPrompt && (
        <>
          {platform === "ddangyo" && (
            <p className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              땡겨요는 배민과 달리 고객의 음식평가는 &quot;맛있어요&quot; 한
              가지만 있습니다. <br />
              &quot;맛있어요&quot;가 없는 리뷰는 고객이 맛있어요를 선택하지 않고
              작성한 리뷰입니다.
            </p>
          )}
          {linkedOnly && linkedStores.length === 0 && (
            <div className="mb-6 rounded-lg border border-border bg-muted/50 p-6 text-center">
              <p className="mb-4 text-muted-foreground">
                {PLATFORM_LABEL[platform] ?? platform} 연동된 매장이 없습니다.
              </p>
              <Link
                href={accountsLink}
                className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                매장 계정 연동하기
              </Link>
            </div>
          )}
          {(!linkedOnly || list.length > 0) && (
            <>
              {isLoading && <p className="text-muted-foreground">로딩 중…</p>}
              <ul className="space-y-2">
                {list.map((review) => (
                  <ReviewManageCard
                    key={review.id}
                    review={review}
                    headerLabel={headerLabelFor(review)}
                    onOpenImages={openImages}
                    replyBlockProps={getReplyBlockProps(review)}
                  />
                ))}
              </ul>
              <div ref={sentinelRef} className="h-4" aria-hidden />
              {isFetchingNextPage && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  더 불러오는 중…
                </p>
              )}
              {!isLoading && list.length === 0 && (
                <p className="text-muted-foreground">리뷰가 없습니다.</p>
              )}
              <p className="mt-4 text-sm text-muted-foreground">총 {count}건</p>
            </>
          )}
        </>
      )}

      <SyncOverlay
        show={
          isSyncing ||
          isSyncingDdangyo ||
          isSyncingYogiyo ||
          isSyncingCoupangEats
        }
        title={isSyncing ? "리뷰 동기화 중… (1~2분 소요)" : "리뷰 동기화 중…"}
      />

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
