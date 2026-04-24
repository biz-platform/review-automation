"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useInvalidateReviewOnRegisterReplyComplete } from "./use-invalidate-review-on-job-complete";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
import {
  PLATFORM_LABEL,
  STORE_MANAGE_PLATFORM_TABS,
  STORE_MANAGE_PLATFORM_TABS_MOBILE,
} from "@/const/platform";
import { ReviewManageCard } from "@/components/review/ReviewManageCard";
import { ReviewLoadingBanner } from "@/components/review/ReviewLoadingBanner";
import { SyncOverlay } from "@/components/review/SyncOverlay";
import { StoreLinkPrompt } from "@/components/store/StoreLinkPrompt";
import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import { LinkedPlatformCheckIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { cn } from "@/lib/utils/cn";
import { useToneSettings } from "@/entities/store/hooks/query/use-tone-settings";
import { useReviewsManageState } from "@/app/(protected)/manage/reviews/use-reviews-manage-state";
import { ReviewsPageFilters } from "@/app/(protected)/manage/reviews/ReviewsPageFilters";
import { registerReply } from "@/entities/reply/api/reply-api";
import { pollBrowserJob } from "@/lib/poll-browser-job";
import { updateReviewInListCache } from "@/entities/review/lib/update-review-in-list-cache";
import { QUERY_KEY } from "@/const/query-keys";
import { getDisplayReplyContent } from "@/entities/review/lib/review-utils";

const REVIEWS_BASE = "/manage/reviews";

function getEmptyReviewMessage(filter: string): string {
  if (filter === "unanswered") return "미답변 리뷰가 없습니다.";
  if (filter === "answered") return "답변완료 리뷰가 없습니다.";
  if (filter === "expired") return "기한만료 리뷰가 없습니다.";
  return "리뷰가 없습니다.";
}

export default function ReviewsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  useInvalidateReviewOnRegisterReplyComplete();
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
    currentList,
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
    showLoadingMoreUi,
    getReplyBlockProps,
    periodFilter,
    setPeriodFilter,
    starFilter,
    setStarFilter,
    filteredList,
    hasLowRatingUnanswered,
    storeIdToName,
    getStoreDisplayName,
    selectedStoreId,
    setSelectedStoreId,
    selectedReviewIds,
    toggleReviewSelection,
    selectAllUnanswered,
    isReviewUnanswered,
    isReviewRegisterable,
    filterCounts,
    showReviewLoadingBanner,
    addPendingRegisterIds,
    removePendingRegister,
    clearSelection,
  } = state;

  const { data: toneSettings } = useToneSettings(effectiveStoreId ?? null);
  const isAutoRegister = toneSettings?.comment_register_mode === "auto";

  const [batchRegister, setBatchRegister] = useState<{
    running: boolean;
    current: number;
    total: number;
    error?: string;
  }>({ running: false, current: 0, total: 0 });

  const handleRegister = useCallback(async () => {
    const selected = filteredList.filter((r) => selectedReviewIds.has(r.id));
    const items: { reviewId: string; storeId: string; content: string }[] = [];
    for (const r of selected) {
      const content =
        r.reply_draft?.approved_content ?? r.reply_draft?.draft_content ?? "";
      if (!content.trim()) continue;
      items.push({
        reviewId: r.id,
        storeId: r.store_id,
        content: content.trim(),
      });
    }
    if (items.length === 0) return;

    addPendingRegisterIds(items.map((i) => i.reviewId));
    setBatchRegister({ running: true, current: 0, total: items.length });

    let done = 0;
    let lastError: string | undefined;
    for (const item of items) {
      try {
        const { jobId } = await registerReply({
          reviewId: item.reviewId,
          content: item.content,
        });
        const job = await pollBrowserJob(item.storeId, jobId);
        if (job.status === "completed") {
          updateReviewInListCache(queryClient, item.reviewId, {
            platform_reply_content: item.content,
          });
          queryClient.invalidateQueries({
            queryKey: QUERY_KEY.reply.draft(item.reviewId),
          });
          queryClient.invalidateQueries({
            queryKey: QUERY_KEY.review.detail(item.reviewId),
          });
          queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
        } else if (job.status === "failed") {
          lastError = job.error_message ?? "플랫폼 댓글 등록 실패";
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      } finally {
        removePendingRegister(item.reviewId);
        done += 1;
        setBatchRegister((prev) => ({
          ...prev,
          current: done,
          error: lastError,
        }));
      }
    }
    setBatchRegister((prev) => ({
      ...prev,
      running: false,
      error: lastError,
    }));
    clearSelection();
  }, [
    filteredList,
    selectedReviewIds,
    addPendingRegisterIds,
    removePendingRegister,
    clearSelection,
    queryClient,
  ]);

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

  const buildReviewsQuery = (opts: {
    platformTab: string;
    filterTab: string;
  }) => {
    const q = new URLSearchParams();
    if (opts.platformTab) q.set("platform", opts.platformTab);
    if (opts.filterTab !== "all") q.set("filter", opts.filterTab);
    if (starFilter !== "all") q.set("star", starFilter);
    const qs = q.toString();
    return qs ? `${REVIEWS_BASE}?${qs}` : REVIEWS_BASE;
  };

  const platformHref = (tabValue: string) =>
    buildReviewsQuery({ platformTab: tabValue, filterTab: effectiveFilter });

  const reviewTabItems = [
    { value: "", label: "전체 플랫폼" },
    ...STORE_MANAGE_PLATFORM_TABS.map((t) => {
      const linked = linkedPlatforms.includes(t.value);
      return {
        value: t.value,
        label: t.label,
        disabled: !linked,
        icon: linked ? <LinkedPlatformCheckIcon /> : undefined,
      };
    }),
  ];
  const reviewTabItemsMobile = [
    { value: "", label: "전체" },
    ...STORE_MANAGE_PLATFORM_TABS.map((t) => {
      const short = STORE_MANAGE_PLATFORM_TABS_MOBILE.find(
        (m) => m.value === t.value,
      );
      const linked = linkedPlatforms.includes(t.value);
      return {
        value: t.value,
        label: short?.label ?? t.label,
        disabled: !linked,
        icon: linked ? <LinkedPlatformCheckIcon /> : undefined,
      };
    }),
  ];
  const tabValue =
    !platform || (linkedPlatforms as readonly string[]).includes(platform)
      ? (platform ?? "")
      : "";

  const filterHref = (filterValue: string) =>
    buildReviewsQuery({ platformTab: platform, filterTab: filterValue });

  /** 실시간 리뷰 불러오기: 플랫폼↔DB 동기화만(자동 답글 파이프라인 없음). 전체 탭이면 연동된 플랫폼별로 동시에 sync job 생성 */
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
  const emptyReviewMessage = getEmptyReviewMessage(effectiveFilter);

  /** 등록하기: 선택 리뷰 중 AI 초안(또는 승인본) 준비된 건이 1개 이상일 때만 활성화 */
  const selectedRegisterableCount = filteredList.reduce((count, review) => {
    if (!selectedReviewIds.has(review.id)) return count;
    if (!isReviewRegisterable(review)) return count;
    const content = getDisplayReplyContent(review);
    if (!content?.trim()) return count;
    return count + 1;
  }, 0);
  const canRegister = selectedRegisterableCount >= 1 && !batchRegister.running;

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
          댓글은 리뷰 작성일 기준 14일 이내에만 작성할 수 있어요.
        </p>

        {hasLowRatingUnanswered && (
          <div className="mb-6 flex w-full items-center gap-4 rounded-lg bg-wgray-06 px-4 py-5">
            <svg
              width="36"
              height="36"
              viewBox="0 0 36 36"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <path
                d="M18 34C19.657 34 21 32.657 21 31H15C15 32.657 16.343 34 18 34Z"
                fill="#FF9E00"
              />
              <path
                d="M30 27H6V24.5L8.5 22V14C8.5 9.58172 12.0817 6 16.5 6C20.9183 6 24.5 9.58172 24.5 14V22L27 24.5V27H30Z"
                fill="#FFC000"
              />
              <path
                d="M26 27H10V24.7929L11.75 23.0429V14C11.75 11.1005 14.1005 8.75 17 8.75C19.8995 8.75 22.25 11.1005 22.25 14V23.0429L24 24.7929V27H26Z"
                fill="#FF9E00"
                opacity="0.25"
              />
            </svg>
            <div className="flex flex-1 flex-col gap-1.5">
              <p className="typo-body-01-bold text-gray-01">
                등록되지 않은 낮은 별점 리뷰가 있어요.
              </p>
              <p className="typo-body-02-regular text-gray-04">
                낮은 별점 리뷰는 자동으로 등록되지 않아요. 사장님께서 내용을
                확인하신 뒤 직접 등록해 주세요.
              </p>
            </div>
          </div>
        )}

        <ReviewsPageFilters
          showReviewLoadingBanner={showReviewLoadingBanner}
          storeFilterOptions={storeFilterOptions}
          selectedStoreId={selectedStoreId}
          onSelectedStoreIdChange={setSelectedStoreId}
          periodFilter={periodFilter}
          onPeriodFilterChange={setPeriodFilter}
          starFilter={starFilter}
          onStarFilterChange={setStarFilter}
          filterCounts={filterCounts}
          filterHref={filterHref}
          effectiveFilter={effectiveFilter}
          filteredList={filteredList}
          isReviewUnanswered={isReviewUnanswered}
          selectedReviewIds={selectedReviewIds}
          onSelectAllUnanswered={selectAllUnanswered}
        />

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
                  review.platform_shop_external_id,
                );
                const platformStoreLabel =
                  storeName != null
                    ? `${PLATFORM_LABEL[review.platform] ?? review.platform} | ${storeName}`
                    : undefined;
                const unanswered = isReviewUnanswered(review);
                const registerable = isReviewRegisterable(review);
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
                    checkboxDisabled={!unanswered || !registerable}
                    onCheckboxToggle={() => toggleReviewSelection(review.id)}
                  />
                );
              })}
            </ul>
            <div ref={sentinelRef} className="h-4" aria-hidden />
            {showLoadingMoreUi && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                더 불러오는 중…
              </p>
            )}
            {!showReviewLoadingBanner &&
              !baeminListLoading &&
              !isFetchingNextBaemin &&
              !hasNextBaemin &&
              filteredList.length === 0 && (
                <p className="py-16 text-center text-muted-foreground">
                  {emptyReviewMessage}
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
            {(!linkedOnly || linkedStores.length > 0) && (
              <>
                {isLoading && <p className="text-muted-foreground">로딩 중…</p>}
                <ul className="mx-auto grid w-full max-w-full grid-cols-1 gap-4 xl:grid-cols-2">
                  {filteredList.map((review) => {
                    const storeName = getStoreDisplayName(
                      review.store_id,
                      review.platform,
                      review.platform_shop_external_id,
                    );
                    const platformStoreLabel =
                      storeName != null
                        ? `${PLATFORM_LABEL[review.platform] ?? review.platform} | ${storeName}`
                        : undefined;
                    const unanswered = isReviewUnanswered(review);
                    const registerable = isReviewRegisterable(review);
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
                        checkboxDisabled={!unanswered || !registerable}
                        onCheckboxToggle={() =>
                          toggleReviewSelection(review.id)
                        }
                      />
                    );
                  })}
                </ul>
                <div ref={sentinelRef} className="h-4" aria-hidden />
                {showLoadingMoreUi && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    더 불러오는 중…
                  </p>
                )}
                {!showReviewLoadingBanner &&
                  !isLoading &&
                  !isFetchingNextPage &&
                  !hasNextPage &&
                  filteredList.length === 0 && (
                    <p className="py-16 text-center text-muted-foreground">
                      {emptyReviewMessage}
                    </p>
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
          {/* 데스크톱: 좌측 안내 문구 (Figma 272-9299). 설정에 따라 직접/자동 등록 문구 분기 */}
          <p className="typo-body-02-regular hidden max-w-4xl text-gray-04 lg:block">
            {isAutoRegister ? (
              <>
                자동 등록이 켜져 있어요
                <br />
                등록하기 버튼을 누르지 않아도 매시간 새 리뷰를 확인해 댓글을
                자동으로 등록해 드려요
              </>
            ) : (
              <>
                수동 등록으로 설정되어 있어요
                <br />
                실시간 리뷰 불러오기를 먼저 진행하고 미답변 리뷰를 선택해서
                댓글을 등록하세요
              </>
            )}
          </p>
          {/* 모바일: 버튼만 전체 너비 */}
          <div className="flex w-full flex-1 flex-row items-center gap-2 md:w-auto md:flex-none">
            <Button
              type="button"
              variant="secondaryDark"
              size="lg"
              className="flex-1 md:w-auto md:flex-none px-4"
              title="플랫폼에 올라온 리뷰를 DB와 맞춥니다. AI 초안·자동 답글은 AI 설정의 예약 자동 댓글에서만 동작합니다."
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
              {batchRegister.running
                ? `등록 중 ${batchRegister.current}/${batchRegister.total}`
                : "등록하기"}
            </Button>
          </div>
        </PageFixedBottomBar>
      </div>
    </div>
  );
}
