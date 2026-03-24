"use client";

import { useSearchParams } from "next/navigation";
import { useState, useRef } from "react";
import type { ReviewListFilter } from "@/entities/review/types";
import { useReviewsManageStores } from "./reviews-manage/use-reviews-manage-stores";
import { useReviewsManageSync } from "./reviews-manage/use-reviews-manage-sync";
import { useReviewsManageFilterCounts } from "./reviews-manage/use-reviews-manage-filter-counts";
import { useReviewsManageReply } from "./reviews-manage/use-reviews-manage-reply";
import { useReviewsManageList } from "./reviews-manage/use-reviews-manage-list";
import { useReviewsManageSelection } from "./reviews-manage/use-reviews-manage-selection";
import { useReviewsManageAutoDraft } from "./reviews-manage/use-reviews-manage-auto-draft";
import { useReviewsManageInfiniteScroll } from "./reviews-manage/use-reviews-manage-infinite-scroll";

const isReviewFilter = (v: string): v is ReviewListFilter =>
  ["all", "unanswered", "answered", "expired"].includes(v);

export function useReviewsManageState() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") ?? "";
  const linkedOnly = !!platform;
  const reviewFilter =
    (searchParams.get("filter") as ReviewListFilter) || "all";
  const effectiveFilter = isReviewFilter(reviewFilter) ? reviewFilter : "all";

  const [imageModal, setImageModal] = useState<{
    images: { imageUrl: string }[];
    index: number;
  } | null>(null);

  const stores = useReviewsManageStores(platform);
  const {
    effectiveStoreId,
    isBaemin,
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
  } = stores;

  const sync = useReviewsManageSync(
    platform,
    effectiveStoreId,
    storesBaemin,
    storesDdangyo,
    storesYogiyo,
    storesCoupangEats,
  );

  const { filterCounts } = useReviewsManageFilterCounts(
    isBaemin,
    effectiveStoreId,
    platform,
    linkedOnly,
    stores.selectedStoreId,
  );

  const skipAutoCreateRef = useRef<Set<string>>(new Set());
  const reply = useReviewsManageReply(skipAutoCreateRef);

  const list = useReviewsManageList(
    isBaemin,
    effectiveStoreId,
    platform,
    linkedOnly,
    effectiveFilter,
    stores.selectedStoreId,
  );
  const { filteredList, currentList } = list;

  const selection = useReviewsManageSelection(filteredList);

  useReviewsManageAutoDraft(currentList, reply.createDraft, skipAutoCreateRef);

  const infiniteScroll = useReviewsManageInfiniteScroll(
    isBaemin,
    list.hasNextBaemin,
    list.isFetchingNextBaemin,
    list.baeminListLoading,
    list.fetchNextBaemin,
    list.hasNextPage,
    list.isFetchingNextPage,
    list.isLoading,
    list.fetchNextPage,
  );

  const showReviewLoadingBanner =
    sync.isSyncing ||
    sync.isSyncingDdangyo ||
    sync.isSyncingYogiyo ||
    sync.isSyncingCoupangEats ||
    (isBaemin &&
      stores.linkedStores.length > 0 &&
      list.baeminListLoading) ||
    (!isBaemin &&
      linkedOnly &&
      stores.linkedStores.length > 0 &&
      list.isLoading) ||
    (platform === "" &&
      stores.linkedPlatforms.length > 0 &&
      list.isLoading);

  return {
    platform,
    effectiveFilter,
    linkedOnly,
    linkedPlatforms: stores.linkedPlatforms,
    accountsLink: stores.accountsLink,
    linkedStores: stores.linkedStores,
    storeFilterOptions: stores.storeFilterOptions,
    allStores: stores.allStores,
    selectedStoreId: stores.selectedStoreId,
    setSelectedStoreId: stores.setSelectedStoreId,
    effectiveStoreId,
    showLinkPrompt: stores.showLinkPrompt,
    isBaemin,
    storesLoading: stores.storesLoading,
    imageModal,
    setImageModal,
    baeminDbList: list.baeminDbList,
    countAll: list.countAll,
    baeminListLoading: list.baeminListLoading,
    hasNextBaemin: list.hasNextBaemin,
    isFetchingNextBaemin: list.isFetchingNextBaemin,
    list: list.list,
    count: list.count,
    isLoading: list.isLoading,
    hasNextPage: list.hasNextPage,
    isFetchingNextPage: list.isFetchingNextPage,
    isSyncing: sync.isSyncing,
    isSyncingDdangyo: sync.isSyncingDdangyo,
    isSyncingYogiyo: sync.isSyncingYogiyo,
    isSyncingCoupangEats: sync.isSyncingCoupangEats,
    handleSyncBaemin: sync.handleSyncBaemin,
    handleSyncDdangyo: sync.handleSyncDdangyo,
    handleSyncYogiyo: sync.handleSyncYogiyo,
    handleSyncCoupangEats: sync.handleSyncCoupangEats,
    handleSyncAll: sync.handleSyncAll,
    sentinelRef: infiniteScroll.sentinelRef,
    getReplyBlockProps: reply.getReplyBlockProps,
    periodFilter: list.periodFilter,
    setPeriodFilter: list.setPeriodFilter,
    starFilter: list.starFilter,
    setStarFilter: list.setStarFilter,
    filteredList,
    storeIdToName: stores.storeIdToName,
    getStoreDisplayName: stores.getStoreDisplayName,
    selectedReviewIds: selection.selectedReviewIds,
    toggleReviewSelection: selection.toggleReviewSelection,
    selectAllUnanswered: selection.selectAllUnanswered,
    isReviewUnanswered: selection.isReviewUnanswered,
    isReviewRegisterable: selection.isReviewRegisterable,
    clearSelection: selection.clearSelection,
    filterCounts,
    showReviewLoadingBanner,
    addPendingRegisterIds: reply.addPendingRegisterIds,
    removePendingRegister: reply.removePendingRegister,
  };
}
