"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useReviewListInfinite } from "@/entities/review/hooks/query/use-review-list-infinite";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import {
  useSyncBaeminReviews,
  type SyncBaeminReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-baemin-reviews";
import {
  useSyncDdangyoReviews,
  type SyncDdangyoReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-ddangyo-reviews";
import {
  useSyncYogiyoReviews,
  type SyncYogiyoReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-yogiyo-reviews";
import {
  useSyncCoupangEatsReviews,
  type SyncCoupangEatsReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-coupang-eats-reviews";
import { useCreateReplyDraft } from "@/entities/reply/hooks/mutation/use-create-reply-draft";
import { useUpdateReplyDraft } from "@/entities/reply/hooks/mutation/use-update-reply-draft";
import { useDeleteReplyDraft } from "@/entities/reply/hooks/mutation/use-delete-reply-draft";
import { useApproveReply } from "@/entities/reply/hooks/mutation/use-approve-reply";
import { useRegisterReply } from "@/entities/reply/hooks/mutation/use-register-reply";
import { useModifyReply } from "@/entities/reply/hooks/mutation/use-modify-reply";
import { useDeleteReply } from "@/entities/reply/hooks/mutation/use-delete-reply";
import { replyPendingCallbacksRef } from "@/entities/reply/lib/reply-pending-callbacks";
import type { ReviewListFilter, ReviewData } from "@/entities/review/types";
import { PLATFORMS_WITH_REPLY_MODIFY_DELETE, type PlatformIdWithReply } from "@/const/platform";
import {
  dedupeById,
  getDisplayReplyContent,
  isReplyExpired,
} from "@/entities/review/lib/review-utils";
import type { ReplyContentBlockProps } from "@/components/review/ReplyContentBlock";

const PLATFORMS_LINKED = ["baemin", "ddangyo", "yogiyo", "coupang_eats"] as const;

export function useReviewsManageState() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") ?? "";
  const linkedOnly = !!platform;
  const reviewFilter = (searchParams.get("filter") as ReviewListFilter) || "all";
  const isReviewFilter = (v: string): v is ReviewListFilter =>
    ["all", "unanswered", "answered", "expired"].includes(v);
  const effectiveFilter = isReviewFilter(reviewFilter) ? reviewFilter : "all";

  const { data: storeListData, isLoading: storesLoading } = useStoreList(
    platform && PLATFORMS_LINKED.includes(platform as (typeof PLATFORMS_LINKED)[number])
      ? platform
      : undefined,
  );
  const { data: allStoresData } = useStoreList();
  const allStores = allStoresData ?? [];
  const linkedStores = platform ? (storeListData ?? []) : [];
  const accountsLink =
    allStores.length > 0
      ? `/manage/stores/${allStores[0].id}/accounts?platform=${platform || "baemin"}`
      : `/manage/stores?accounts=1&platform=${platform || "baemin"}`;

  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [imageModal, setImageModal] = useState<{
    images: { imageUrl: string }[];
    index: number;
  } | null>(null);

  useEffect(() => {
    if (
      linkedStores.length > 0 &&
      !linkedStores.some((s) => s.id === selectedStoreId)
    ) {
      setSelectedStoreId(linkedStores[0].id);
    }
  }, [linkedStores, selectedStoreId]);

  const effectiveStoreId =
    selectedStoreId && linkedStores.some((s) => s.id === selectedStoreId)
      ? selectedStoreId
      : (linkedStores[0]?.id ?? null);

  const isBaemin = platform === "baemin";
  const showLinkPrompt = isBaemin && !storesLoading && linkedStores.length === 0;

  const {
    data: baeminData,
    isLoading: baeminListLoading,
    fetchNextPage: fetchNextBaemin,
    hasNextPage: hasNextBaemin,
    isFetchingNextPage: isFetchingNextBaemin,
  } = useReviewListInfinite(
    isBaemin && effectiveStoreId
      ? {
          store_id: effectiveStoreId,
          platform: "baemin",
          filter: effectiveFilter,
          include_drafts: true,
        }
      : null,
  );

  const baeminDbList = dedupeById(
    (isBaemin ? baeminData?.pages.flatMap((p) => p.result) : []) ?? [],
  );
  const countAll = isBaemin ? (baeminData?.pages[0]?.count ?? 0) : 0;

  const { mutate: syncBaemin, isPending: isSyncing, reset: resetSync, isError: isSyncError, error: syncError } =
    useSyncBaeminReviews();
  const {
    mutate: syncDdangyo,
    isPending: isSyncingDdangyo,
    reset: resetSyncDdangyo,
    isError: isSyncErrorDdangyo,
    error: syncErrorDdangyo,
  } = useSyncDdangyoReviews();
  const {
    mutate: syncYogiyo,
    isPending: isSyncingYogiyo,
    reset: resetSyncYogiyo,
    isError: isSyncErrorYogiyo,
    error: syncErrorYogiyo,
  } = useSyncYogiyoReviews();
  const {
    mutate: syncCoupangEats,
    isPending: isSyncingCoupangEats,
    reset: resetSyncCoupangEats,
    isError: isSyncErrorCoupangEats,
    error: syncErrorCoupangEats,
  } = useSyncCoupangEatsReviews();

  const syncAbortRef = useRef<AbortController | null>(null);
  const syncDdangyoAbortRef = useRef<AbortController | null>(null);
  const syncYogiyoAbortRef = useRef<AbortController | null>(null);
  const syncCoupangEatsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isSyncing) syncAbortRef.current = null;
  }, [isSyncing]);
  useEffect(() => {
    if (!isSyncingDdangyo) syncDdangyoAbortRef.current = null;
  }, [isSyncingDdangyo]);
  useEffect(() => {
    if (!isSyncingYogiyo) syncYogiyoAbortRef.current = null;
  }, [isSyncingYogiyo]);
  useEffect(() => {
    if (isSyncError && (syncError as Error)?.name === "AbortError") resetSync();
  }, [isSyncError, syncError, resetSync]);
  useEffect(() => {
    if (isSyncErrorDdangyo && (syncErrorDdangyo as Error)?.name === "AbortError")
      resetSyncDdangyo();
  }, [isSyncErrorDdangyo, syncErrorDdangyo, resetSyncDdangyo]);
  useEffect(() => {
    if (isSyncErrorYogiyo && (syncErrorYogiyo as Error)?.name === "AbortError")
      resetSyncYogiyo();
  }, [isSyncErrorYogiyo, syncErrorYogiyo, resetSyncYogiyo]);
  useEffect(() => {
    if (!isSyncing) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncing]);
  useEffect(() => {
    if (!isSyncingDdangyo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncingDdangyo]);
  useEffect(() => {
    if (!isSyncingYogiyo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncingYogiyo]);
  useEffect(() => {
    if (!isSyncingCoupangEats) syncCoupangEatsAbortRef.current = null;
  }, [isSyncingCoupangEats]);
  useEffect(() => {
    if (
      isSyncErrorCoupangEats &&
      (syncErrorCoupangEats as Error)?.name === "AbortError"
    )
      resetSyncCoupangEats();
  }, [isSyncErrorCoupangEats, syncErrorCoupangEats, resetSyncCoupangEats]);
  useEffect(() => {
    if (!isSyncingCoupangEats) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncingCoupangEats]);

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useReviewListInfinite(
      !isBaemin
        ? {
            platform: platform && platform !== "baemin" ? platform : undefined,
            linked_only: linkedOnly && platform !== "baemin",
            filter: effectiveFilter,
            include_drafts: true,
          }
        : null,
    );

  const createDraft = useCreateReplyDraft();
  const updateDraft = useUpdateReplyDraft();
  const deleteDraft = useDeleteReplyDraft();
  const approveReply = useApproveReply();
  const registerReply = useRegisterReply();
  const modifyReply = useModifyReply();
  const deleteReply = useDeleteReply();

  const [pendingModifyIds, setPendingModifyIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const [pendingRegisterIds, setPendingRegisterIds] = useState<Set<string>>(new Set());

  const removePendingModify = useCallback((id: string) => {
    setPendingModifyIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const removePendingDelete = useCallback((id: string) => {
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);
  const removePendingRegister = useCallback((id: string) => {
    setPendingRegisterIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  useEffect(() => {
    replyPendingCallbacksRef.current = {
      removePendingModify,
      removePendingDelete,
      removePendingRegister,
    };
    return () => {
      replyPendingCallbacksRef.current = null;
    };
  }, [removePendingModify, removePendingDelete, removePendingRegister]);

  const isCreatingDraft = useCallback(
    (reviewId: string) =>
      createDraft.isPending && createDraft.variables?.reviewId === reviewId,
    [createDraft.isPending, createDraft.variables?.reviewId],
  );
  const isUpdatingDraft = useCallback(
    (reviewId: string) =>
      updateDraft.isPending && updateDraft.variables?.reviewId === reviewId,
    [updateDraft.isPending, updateDraft.variables?.reviewId],
  );
  const isDeletingDraft = useCallback(
    (reviewId: string) =>
      deleteDraft.isPending && deleteDraft.variables?.reviewId === reviewId,
    [deleteDraft.isPending, deleteDraft.variables?.reviewId],
  );
  const isApprovingReply = useCallback(
    (reviewId: string) =>
      pendingRegisterIds.has(reviewId) ||
      (approveReply.isPending && approveReply.variables?.reviewId === reviewId) ||
      (registerReply.isPending && registerReply.variables?.reviewId === reviewId),
    [
      pendingRegisterIds,
      approveReply.isPending,
      approveReply.variables?.reviewId,
      registerReply.isPending,
      registerReply.variables?.reviewId,
    ],
  );
  const isModifyingPlatform = useCallback(
    (reviewId: string) => pendingModifyIds.has(reviewId),
    [pendingModifyIds],
  );
  const isDeletingPlatform = useCallback(
    (reviewId: string) => pendingDeleteIds.has(reviewId),
    [pendingDeleteIds],
  );

  const list = dedupeById(data?.pages.flatMap((p) => p.result) ?? []);
  const count = data?.pages[0]?.count ?? 0;
  const currentList = isBaemin ? baeminDbList : list;

  const requestedDraftRef = useRef<Set<string>>(new Set());
  const queueRef = useRef<string[]>([]);
  const skipAutoCreateRef = useRef<Set<string>>(new Set());

  const runNextDraftRef = useRef<() => void>(() => {});
  runNextDraftRef.current = () => {
    if (queueRef.current.length === 0) return;
    const reviewId = queueRef.current.shift()!;
    createDraft.mutate(
      { reviewId },
      { onSuccess: () => runNextDraftRef.current() },
    );
  };
  const processNextDraftRef = useRef<() => void>(() => {});
  processNextDraftRef.current = () => {
    if (createDraft.isPending || queueRef.current.length === 0) return;
    runNextDraftRef.current();
  };

  useEffect(() => {
    if (!currentList.length) return;
    for (const review of currentList) {
      const content = getDisplayReplyContent(review);
      if (content != null) continue;
      if (isReplyExpired(review.written_at ?? null, review.platform)) continue;
      if (requestedDraftRef.current.has(review.id)) continue;
      if (skipAutoCreateRef.current.has(review.id)) continue;
      requestedDraftRef.current.add(review.id);
      queueRef.current.push(review.id);
    }
    processNextDraftRef.current();
  }, [currentList, createDraft.isPending]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMore = useCallback(() => {
    if (isBaemin) {
      if (hasNextBaemin && !isFetchingNextBaemin) fetchNextBaemin();
    } else {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    }
  }, [
    isBaemin,
    hasNextBaemin,
    isFetchingNextBaemin,
    fetchNextBaemin,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  ]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "100px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const getReplyBlockProps = useCallback(
    (review: ReviewData): ReplyContentBlockProps => {
      const canEdit =
        !isReplyExpired(review.written_at ?? null, review.platform) &&
        !review.platform_reply_content;
      const supportsModifyDelete = PLATFORMS_WITH_REPLY_MODIFY_DELETE.includes(
        review.platform as PlatformIdWithReply,
      );
      return {
        review,
        canEdit,
        isCreating: isCreatingDraft(review.id),
        onCreateDraft: (id) => createDraft.mutate({ reviewId: id }),
        onCreateDraftWithContent: async (id, draft_content) => {
          await createDraft.mutateAsync({ reviewId: id, draft_content });
        },
        onUpdateDraft: (id, draft_content, onSuccess) =>
          updateDraft.mutate({ reviewId: id, draft_content }, { onSuccess }),
        onApprove: (id, approved_content) => {
          approveReply.mutate(
            { reviewId: id, approved_content },
            {
              onSuccess: () => {
                if (PLATFORMS_LINKED.includes(review.platform as (typeof PLATFORMS_LINKED)[number])) {
                  setPendingRegisterIds((s) => new Set(s).add(id));
                  registerReply.mutate({
                    reviewId: id,
                    storeId: review.store_id,
                    content: approved_content,
                  });
                }
              },
            },
          );
        },
        onDelete: (id) => deleteDraft.mutate({ reviewId: id }),
        onDeleted: (id) => skipAutoCreateRef.current.add(id),
        isUpdating: isUpdatingDraft,
        isApproving: isApprovingReply,
        isDeleting: isDeletingDraft,
        onModifyPlatformReply: supportsModifyDelete
          ? (id, content) => {
              setPendingModifyIds((s) => new Set(s).add(id));
              modifyReply.mutate({
                reviewId: id,
                storeId: review.store_id,
                content,
              });
            }
          : undefined,
        onDeletePlatformReply: supportsModifyDelete
          ? (id) => {
              setPendingDeleteIds((s) => new Set(s).add(id));
              deleteReply.mutate({
                reviewId: id,
                storeId: review.store_id,
              });
            }
          : undefined,
        isModifyingPlatform: isModifyingPlatform,
        isDeletingPlatform: isDeletingPlatform,
      };
    },
    [
      isCreatingDraft,
      createDraft,
      updateDraft,
      approveReply,
      registerReply,
      deleteDraft,
      modifyReply,
      deleteReply,
      isUpdatingDraft,
      isApprovingReply,
      isDeletingDraft,
      isModifyingPlatform,
      isDeletingPlatform,
    ],
  );

  const handleSyncBaemin = useCallback(() => {
    if (!effectiveStoreId || isSyncing) return;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncBaemin({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncBaeminReviewsVariables);
  }, [effectiveStoreId, isSyncing, syncBaemin]);

  const handleSyncDdangyo = useCallback(() => {
    if (!effectiveStoreId || isSyncingDdangyo) return;
    const controller = new AbortController();
    syncDdangyoAbortRef.current = controller;
    syncDdangyo({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncDdangyoReviewsVariables);
  }, [effectiveStoreId, isSyncingDdangyo, syncDdangyo]);

  const handleSyncYogiyo = useCallback(() => {
    if (!effectiveStoreId || isSyncingYogiyo) return;
    const controller = new AbortController();
    syncYogiyoAbortRef.current = controller;
    syncYogiyo({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncYogiyoReviewsVariables);
  }, [effectiveStoreId, isSyncingYogiyo, syncYogiyo]);

  const handleSyncCoupangEats = useCallback(() => {
    if (!effectiveStoreId || isSyncingCoupangEats) return;
    const controller = new AbortController();
    syncCoupangEatsAbortRef.current = controller;
    syncCoupangEats({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncCoupangEatsReviewsVariables);
  }, [effectiveStoreId, isSyncingCoupangEats, syncCoupangEats]);

  return {
    platform,
    effectiveFilter,
    linkedOnly,
    accountsLink,
    linkedStores,
    allStores,
    selectedStoreId,
    setSelectedStoreId,
    effectiveStoreId,
    showLinkPrompt,
    isBaemin,
    storesLoading,
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
  };
}
