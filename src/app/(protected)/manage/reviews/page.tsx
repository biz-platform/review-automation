"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import {
  PLATFORM_TABS,
  PLATFORM_LABEL,
  STORE_MANAGE_PLATFORM_TABS_MOBILE,
} from "@/const/platform";
import { ReviewManageCard } from "@/components/review/ReviewManageCard";
import { ReviewLoadingBanner } from "@/components/review/ReviewLoadingBanner";
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { StoreLinkPrompt } from "@/components/store/StoreLinkPrompt";
import { ManageSectionTabLine } from "../ManageSectionTabLine";
import { Button } from "@/components/ui/button";
import { TagSelect } from "@/components/ui/tag-select";
import { OptionItem } from "@/components/ui/option-item";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { cn } from "@/lib/utils/cn";
import { useReviewsManageState } from "./use-reviews-manage-state";
import {
  REVIEW_FILTER_TABS,
  PERIOD_FILTER_OPTIONS,
  STAR_RATING_OPTIONS,
} from "./constants";

const REVIEWS_BASE = "/manage/reviews";

function LinkedPlatformIcon() {
  return (
    <svg
      className="h-5 w-5 text-main-02"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ReviewsPage() {
  const router = useRouter();
  const state = useReviewsManageState();
  const {
    platform,
    effectiveFilter,
    linkedOnly,
    linkedPlatforms,
    accountsLink,
    linkedStores,
    storeFilterOptions,
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
    handleSyncAll,
    sentinelRef,
    getReplyBlockProps,
    periodFilter,
    setPeriodFilter,
    starFilter,
    setStarFilter,
    filteredList,
    storeIdToName,
    getStoreDisplayName,
    selectedStoreId,
    setSelectedStoreId,
    selectedReviewIds,
    toggleReviewSelection,
    selectAllUnanswered,
    isReviewUnanswered,
    filterCounts,
    showReviewLoadingBanner,
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

  const reviewTabItems = [
    { value: "", label: "전체 플랫폼" },
    ...PLATFORM_TABS.filter(
      (t): t is (typeof PLATFORM_TABS)[number] =>
        !!t.value && linkedPlatforms.includes(t.value),
    ).map((t) => ({
      value: t.value,
      label: t.label,
      icon: <LinkedPlatformIcon />,
    })),
  ];
  const reviewTabItemsMobile = [
    { value: "", label: "전체" },
    ...PLATFORM_TABS.filter(
      (t): t is (typeof PLATFORM_TABS)[number] =>
        !!t.value && linkedPlatforms.includes(t.value),
    ).map((t) => {
      const short = STORE_MANAGE_PLATFORM_TABS_MOBILE.find(
        (m) => m.value === t.value,
      );
      return {
        value: t.value,
        label: short?.label ?? t.label,
        icon: <LinkedPlatformIcon />,
      };
    }),
  ];
  const tabValue =
    !platform || (linkedPlatforms as readonly string[]).includes(platform)
      ? (platform ?? "")
      : "";

  const filterHref = (filterValue: string) => {
    const base = platform
      ? `${REVIEWS_BASE}?platform=${platform}`
      : REVIEWS_BASE;
    return filterValue === "all"
      ? base
      : `${base}${base.includes("?") ? "&" : "?"}filter=${filterValue}`;
  };

  /** 실시간 리뷰 불러오기: 전체 플랫폼이면 연동된 모든 매장 동기화, 아니면 해당 플랫폼만 */
  const handleLoadReviews = () => {
    if (platform === "") handleSyncAll();
    else if (platform === "baemin") handleSyncBaemin();
    else if (platform === "ddangyo") handleSyncDdangyo();
    else if (platform === "yogiyo") handleSyncYogiyo();
    else if (platform === "coupang_eats") handleSyncCoupangEats();
  };
  const isLoadReviewsPending =
    isSyncing || isSyncingDdangyo || isSyncingYogiyo || isSyncingCoupangEats;
  const canLoadReviews =
    platform === ""
      ? linkedPlatforms.length > 0
      : linkedStores.length > 0 &&
        (platform === "baemin" ||
          platform === "ddangyo" ||
          platform === "yogiyo" ||
          platform === "coupang_eats");

  /** 등록하기: 1개 이상 선택 시에만 활성화 */
  const canRegister = selectedReviewIds.size >= 1;
  const handleRegister = () => {
    // TODO: 선택된 리뷰 일괄 등록 API 연동
  };

  return (
    <div className="flex flex-col pb-[100px]">
      {/* 댓글 관리: 플랫폼 탭 (전체 플랫폼, 배민, 쿠팡이츠 …) — 스타일 공통화 */}
      <ManageSectionTabLine
        items={reviewTabItems}
        itemsMobile={reviewTabItemsMobile}
        value={tabValue}
        onValueChange={(value) => router.push(platformHref(value))}
      />
      <div className="pt-10">
        <h1 className="typo-heading-02-bold mb-2 text-gray-01">
          등록된 리뷰 목록
        </h1>
        <p className="typo-body-02-regular text-gray-04 mb-9">
          최근 6개월 리뷰를 불러와서 보여줘요.
          <br />
          댓글은 최근 30일 이내 등록된 리뷰에만 작성할 수 있어요.
        </p>

        {!showReviewLoadingBanner && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <select
              className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01 min-w-[140px]"
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              aria-label="업체별 필터"
              disabled={storeFilterOptions.length <= 1}
            >
              {storeFilterOptions.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01"
                value={periodFilter}
                onChange={(e) =>
                  setPeriodFilter(
                    e.target
                      .value as (typeof PERIOD_FILTER_OPTIONS)[number]["value"],
                  )
                }
              >
                {PERIOD_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <select
                className="rounded-lg border border-border bg-white px-3 py-2 typo-body-03-regular text-gray-01"
                value={starFilter}
                onChange={(e) =>
                  setStarFilter(
                    e.target
                      .value as (typeof STAR_RATING_OPTIONS)[number]["value"],
                  )
                }
              >
                {STAR_RATING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!showReviewLoadingBanner && (
          <div className="mb-4 flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
            {REVIEW_FILTER_TABS.map((tab) => {
              const n = filterCounts[tab.value];
              const label = `${tab.label} ${n}개`;
              return (
                <Link key={tab.value} href={filterHref(tab.value)}>
                  <TagSelect
                    variant={
                      effectiveFilter === tab.value ? "checked" : "default"
                    }
                  >
                    {label}
                  </TagSelect>
                </Link>
              );
            })}
          </div>
        )}

        {!showReviewLoadingBanner &&
          (effectiveFilter === "all" || effectiveFilter === "unanswered") && (
            <div className="mb-4">
              <OptionItem
                variant={(() => {
                  const unanswered = filteredList.filter((r) =>
                    isReviewUnanswered(r),
                  );
                  const allSelected =
                    unanswered.length > 0 &&
                    unanswered.every((r) => selectedReviewIds.has(r.id));
                  return allSelected ? "checked" : "default";
                })()}
                onClick={selectAllUnanswered}
              >
                미답변 리뷰 전체 선택
              </OptionItem>
            </div>
          )}

        {showReviewLoadingBanner && (
          <div className="mb-4">
            <ReviewLoadingBanner />
          </div>
        )}

        {showLinkPrompt && (
          <StoreLinkPrompt
            message="배달의민족 연동된 매장이 없습니다."
            linkHref={accountsLink}
          />
        )}

        {isBaemin && linkedStores.length > 0 && (
          <>
            {baeminListLoading && (
              <p className="text-muted-foreground">리뷰 목록 로딩 중…</p>
            )}
            <ul className="mx-auto grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-2">
              {filteredList.map((review) => {
                const storeName = getStoreDisplayName(
                  review.store_id,
                  review.platform,
                );
                const platformStoreLabel =
                  storeName != null
                    ? `${PLATFORM_LABEL[review.platform] ?? review.platform} | ${storeName}`
                    : undefined;
                const unanswered = isReviewUnanswered(review);
                return (
                  <ReviewManageCard
                    key={review.id}
                    review={review}
                    headerLabel={review.author_name ?? ""}
                    onOpenImages={openImages}
                    replyBlockProps={getReplyBlockProps(review)}
                    platformStoreLabel={platformStoreLabel}
                    showCheckbox
                    checked={selectedReviewIds.has(review.id)}
                    checkboxDisabled={!unanswered}
                    onCheckboxToggle={() => toggleReviewSelection(review.id)}
                  />
                );
              })}
            </ul>
            <div ref={sentinelRef} className="h-4" aria-hidden />
            {isFetchingNextBaemin && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                더 불러오는 중…
              </p>
            )}
            {!showReviewLoadingBanner &&
              !baeminListLoading &&
              filteredList.length === 0 && (
                <p className="text-muted-foreground">
                  저장된 리뷰가 없습니다. 하단 &quot;실시간 리뷰
                  불러오기&quot;를 눌러 가져오세요.
                </p>
              )}
          </>
        )}

        {!isBaemin && !showLinkPrompt && (
          <>
            {platform === "ddangyo" && (
              <p className="mb-4 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                땡겨요는 배민과 달리 고객의 음식평가는 &quot;맛있어요&quot; 한
                가지만 있습니다. <br />
                &quot;맛있어요&quot;가 없는 리뷰는 고객이 맛있어요를 선택하지
                않고 작성한 리뷰입니다.
              </p>
            )}
            {linkedOnly && linkedStores.length === 0 && (
              <StoreLinkPrompt
                message={`${PLATFORM_LABEL[platform] ?? platform} 연동된 매장이 없습니다.`}
                linkHref={accountsLink}
              />
            )}
            {(!linkedOnly || list.length > 0) && (
              <>
                {isLoading && <p className="text-muted-foreground">로딩 중…</p>}
                <ul className="mx-auto grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-2">
                  {filteredList.map((review) => {
                    const storeName = getStoreDisplayName(
                      review.store_id,
                      review.platform,
                    );
                    const platformStoreLabel =
                      storeName != null
                        ? `${PLATFORM_LABEL[review.platform] ?? review.platform} | ${storeName}`
                        : undefined;
                    const unanswered = isReviewUnanswered(review);
                    return (
                      <ReviewManageCard
                        key={review.id}
                        review={review}
                        headerLabel={headerLabelFor(review)}
                        onOpenImages={openImages}
                        replyBlockProps={getReplyBlockProps(review)}
                        platformStoreLabel={platformStoreLabel}
                        showCheckbox
                        checked={selectedReviewIds.has(review.id)}
                        checkboxDisabled={!unanswered}
                        onCheckboxToggle={() =>
                          toggleReviewSelection(review.id)
                        }
                      />
                    );
                  })}
                </ul>
                <div ref={sentinelRef} className="h-4" aria-hidden />
                {isFetchingNextPage && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    더 불러오는 중…
                  </p>
                )}
                {!showReviewLoadingBanner &&
                  !isLoading &&
                  filteredList.length === 0 && (
                    <p className="text-muted-foreground">리뷰가 없습니다.</p>
                  )}
                {!showReviewLoadingBanner && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    총 {count}건
                  </p>
                )}
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
          title={isSyncing ? "리뷰 동기화 중…" : "리뷰 동기화 중…"}
        />

        {imageModal && (
          <ReviewImageModal
            images={imageModal.images}
            initialIndex={imageModal.index}
            onClose={() => setImageModal(null)}
          />
        )}

        <PageFixedBottomBar
          className={cn(
            "w-full flex-row items-center gap-2",
            "px-4 md:pl-10 md:pr-15",
            "justify-stretch md:justify-between",
          )}
        >
          {/* 데스크톱: 좌측 안내 문구 (Figma 272-9299) */}
          <p className="typo-body-03-regular hidden max-w-[478px] text-gray-04 lg:block">
            자동 등록이 켜져 있어요
            <br />
            등록하기 버튼을 누르지 않아도 매시간 새 리뷰를 확인해 댓글을
            자동으로 등록해 드려요
          </p>
          {/* 모바일: 버튼만 전체 너비 */}
          <div className="flex w-full flex-1 flex-row items-center gap-2 md:w-auto md:flex-none">
            <Button
              type="button"
              variant="secondaryDark"
              size="lg"
              className="flex-1 md:w-auto md:flex-none px-4"
              onClick={handleLoadReviews}
              disabled={!canLoadReviews || isLoadReviewsPending}
            >
              <span className="md:hidden">리뷰 불러오기</span>
              <span className="hidden md:inline">실시간 리뷰 불러오기</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="flex-1 md:w-[160px] md:flex-none"
              onClick={handleRegister}
              disabled={!canRegister}
            >
              등록하기
            </Button>
          </div>
        </PageFixedBottomBar>
      </div>
    </div>
  );
}
