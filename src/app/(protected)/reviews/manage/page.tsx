"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { ReviewImageModal } from "@/components/shared/ReviewImageModal";
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
import type { ReviewListFilter, ReviewData } from "@/entities/review/types";

const PLATFORM_TABS = [
  { value: "", label: "전체 플랫폼" },
  { value: "baemin", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "yogiyo", label: "요기요" },
  { value: "ddangyo", label: "땡겨요" },
  { value: "naver", label: "네이버" },
] as const;

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  baemin: "배달의민족",
  yogiyo: "요기요",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
};

const REVIEW_FILTER_TABS: { value: ReviewListFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unanswered", label: "미답변" },
  { value: "answered", label: "답변완료" },
  { value: "expired", label: "기한만료" },
];

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function isReplyExpired(writtenAt: string | null): boolean {
  if (!writtenAt) return false;
  const written = new Date(writtenAt).getTime();
  const deadline = written + 14 * 24 * 60 * 60 * 1000;
  return Date.now() > deadline;
}

function ReplyStatusBadge({
  platformReplyContent,
  writtenAt,
}: {
  platformReplyContent: string | null;
  writtenAt: string | null;
}) {
  const expired = isReplyExpired(writtenAt);
  if (expired)
    return (
      <span className="rounded bg-muted px-2 py-0.5 text-xs">기한만료</span>
    );
  if (platformReplyContent)
    return (
      <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
        답변완료
      </span>
    );
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
      미답변
    </span>
  );
}

function getDisplayReplyContent(review: ReviewData): string | null {
  if (review.platform_reply_content) return review.platform_reply_content;
  const d = review.reply_draft;
  if (d?.approved_content) return d.approved_content;
  if (d?.draft_content) return d.draft_content;
  return null;
}

function ReplyContentBlock({
  review,
  canEdit,
  isCreating,
  onCreateDraft,
  onCreateDraftWithContent,
  onUpdateDraft,
  onApprove,
  onDelete,
  onDeleted,
  isUpdating,
  isApproving,
  isDeleting,
}: {
  review: ReviewData;
  canEdit: boolean;
  isCreating: boolean;
  onCreateDraft: (reviewId: string) => void;
  onCreateDraftWithContent?: (reviewId: string, draft_content: string) => void | Promise<void>;
  onUpdateDraft: (
    reviewId: string,
    draft_content: string,
    onSuccess?: () => void,
  ) => void;
  onApprove: (reviewId: string, approved_content: string) => void;
  onDelete: (reviewId: string) => void;
  onDeleted: (reviewId: string) => void;
  isUpdating: (reviewId: string) => boolean;
  isApproving: (reviewId: string) => boolean;
  isDeleting: (reviewId: string) => boolean;
}) {
  const content = getDisplayReplyContent(review);
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState("");
  const withinTwoWeeks = !isReplyExpired(review.written_at ?? null);
  const hasPlatformReply = !!review.platform_reply_content;
  const isDraftOnly = content != null && !hasPlatformReply;

  if (content && !isEditing) {
    return (
      <div className="mt-2 rounded bg-muted/50 p-2 text-sm">
        {hasPlatformReply ? (
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            플랫폼 등록 답글
          </span>
        ) : (
          <span className="mb-1 block text-xs font-medium text-muted-foreground">
            AI 초안
          </span>
        )}
        <p className="whitespace-pre-wrap">{content}</p>

        {hasPlatformReply && withinTwoWeeks && (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={async () => {
                if (onCreateDraftWithContent) {
                  await onCreateDraftWithContent(review.id, content);
                }
                setLocalContent(content);
                setIsEditing(true);
              }}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(review.id);
                onDeleted(review.id);
              }}
              disabled={isDeleting(review.id)}
              className="rounded border border-destructive/50 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {isDeleting(review.id) ? "삭제 중…" : "삭제"}
            </button>
          </div>
        )}

        {isDraftOnly && canEdit && (
          <div className="mt-2 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setLocalContent(content);
                setIsEditing(true);
              }}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => onApprove(review.id, content)}
              disabled={isApproving(review.id)}
              className="rounded border border-border bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isApproving(review.id) ? "전송 중…" : "바로 등록"}
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete(review.id);
                onDeleted(review.id);
                onCreateDraft(review.id);
              }}
              disabled={isDeleting(review.id) || isCreating}
              className="rounded border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
            >
              {isCreating ? "재생성 중…" : "재생성"}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (content && isEditing) {
    return (
      <div className="mt-2 rounded bg-muted/50 p-2">
        <textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() =>
              onUpdateDraft(review.id, localContent, () => setIsEditing(false))
            }
            disabled={isUpdating(review.id) || !localContent.trim()}
            className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
          >
            {isUpdating(review.id) ? "저장 중…" : "저장"}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="rounded border border-border px-2 py-1 text-xs hover:bg-muted"
          >
            취소
          </button>
        </div>
      </div>
    );
  }

  const expired = isReplyExpired(review.written_at ?? null);
  if (expired) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        기한이 만료되어 댓글을 작성하거나 수정할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-muted-foreground">
        {isCreating ? "초안 생성 중…" : "초안 없음"}
      </span>
      {!isCreating && (
        <button
          type="button"
          onClick={() => onCreateDraft(review.id)}
          className="rounded border border-border bg-muted/50 px-2 py-1 text-xs font-medium hover:bg-muted"
        >
          AI 초안 생성
        </button>
      )}
    </div>
  );
}

export default function ReviewsManagePage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") ?? "";
  const linkedOnly = !!platform;
  const reviewFilter =
    (searchParams.get("filter") as ReviewListFilter) || "all";
  const isReviewFilter = (v: string): v is ReviewListFilter =>
    ["all", "unanswered", "answered", "expired"].includes(v);
  const effectiveFilter = isReviewFilter(reviewFilter) ? reviewFilter : "all";

  const { data: storeListData, isLoading: storesLoading } = useStoreList(
    platform &&
      ["baemin", "ddangyo", "yogiyo", "coupang_eats"].includes(platform)
      ? platform
      : undefined,
  );
  const { data: allStoresData } = useStoreList();
  const allStores = allStoresData ?? [];
  const linkedStores = platform ? (storeListData ?? []) : [];
  /** 매장 계정 연동하기 링크: 첫 매장 계정 페이지 + platform 쿼리 (매장 없으면 매장 목록으로) */
  const accountsLink =
    allStores.length > 0
      ? `/stores/${allStores[0].id}/accounts?platform=${platform || "baemin"}`
      : `/stores?accounts=1&platform=${platform || "baemin"}`;
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
  const showLinkPrompt =
    isBaemin && !storesLoading && linkedStores.length === 0;

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

  const {
    mutate: syncBaemin,
    isPending: isSyncing,
    reset: resetSync,
    isError: isSyncError,
    error: syncError,
  } = useSyncBaeminReviews();
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
    if (isSyncErrorDdangyo && (syncErrorDdangyo as Error)?.name === "AbortError") resetSyncDdangyo();
  }, [isSyncErrorDdangyo, syncErrorDdangyo, resetSyncDdangyo]);
  useEffect(() => {
    if (isSyncErrorYogiyo && (syncErrorYogiyo as Error)?.name === "AbortError") resetSyncYogiyo();
  }, [isSyncErrorYogiyo, syncErrorYogiyo, resetSyncYogiyo]);
  useEffect(() => {
    if (!isSyncing) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncing]);
  useEffect(() => {
    if (!isSyncingDdangyo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncingDdangyo]);
  useEffect(() => {
    if (!isSyncingYogiyo) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSyncingYogiyo]);
  useEffect(() => {
    if (!isSyncingCoupangEats) syncCoupangEatsAbortRef.current = null;
  }, [isSyncingCoupangEats]);
  useEffect(() => {
    if (isSyncErrorCoupangEats && (syncErrorCoupangEats as Error)?.name === "AbortError") resetSyncCoupangEats();
  }, [isSyncErrorCoupangEats, syncErrorCoupangEats, resetSyncCoupangEats]);
  useEffect(() => {
    if (!isSyncingCoupangEats) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
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
  const isCreatingDraft = (reviewId: string) =>
    createDraft.isPending && createDraft.variables?.reviewId === reviewId;
  const isUpdatingDraft = (reviewId: string) =>
    updateDraft.isPending && updateDraft.variables?.reviewId === reviewId;
  const isDeletingDraft = (reviewId: string) =>
    deleteDraft.isPending && deleteDraft.variables?.reviewId === reviewId;
  const isApprovingReply = (reviewId: string) =>
    (approveReply.isPending && approveReply.variables?.reviewId === reviewId) ||
    (registerReply.isPending && registerReply.variables?.reviewId === reviewId);

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
      if (isReplyExpired(review.written_at ?? null)) continue;
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

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold">리뷰 관리</h1>

      <nav className="mb-6 flex flex-wrap gap-2 border-b border-border pb-4">
        {PLATFORM_TABS.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={
              tab.value
                ? `/reviews/manage?platform=${tab.value}`
                : "/reviews/manage"
            }
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              platform === tab.value || (!platform && !tab.value)
                ? "bg-primary text-primary-foreground"
                : "border border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className="mb-4 flex flex-wrap gap-2">
        {REVIEW_FILTER_TABS.map((tab) => {
          const base = platform
            ? `/reviews/manage?platform=${platform}`
            : "/reviews/manage";
          const href =
            tab.value === "all"
              ? base
              : `${base}${base.includes("?") ? "&" : "?"}filter=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`rounded-md px-4 py-2 text-sm font-medium ${
                effectiveFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
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

      {(isBaemin || platform === "ddangyo" || platform === "yogiyo" || platform === "coupang_eats") && linkedStores.length > 0 && (
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
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <span className="text-foreground">전체 {countAll}건</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!effectiveStoreId || isSyncing) return;
                const controller = new AbortController();
                syncAbortRef.current = controller;
                syncBaemin({
                  storeId: effectiveStoreId,
                  signal: controller.signal,
                } as SyncBaeminReviewsVariables);
              }}
              disabled={!effectiveStoreId || isSyncing}
              className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
            >
              {isSyncing ? "리뷰 동기화 중… (1~2분 소요)" : "리뷰 동기화"}
            </button>
          </div>
          {baeminListLoading && (
            <p className="text-muted-foreground">리뷰 목록 로딩 중…</p>
          )}
          <ul className="space-y-2">
            {baeminDbList.map((review) => (
              <li
                key={review.id}
                className="rounded-lg border border-border p-4"
              >
                <div className="block">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {review.rating != null ? `${review.rating}점` : ""}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {review.author_name ?? ""}
                    </span>
                    {review.written_at != null && (
                      <span className="text-xs text-muted-foreground">
                        {review.written_at.slice(0, 10)}
                      </span>
                    )}
                    <ReplyStatusBadge
                      platformReplyContent={
                        review.platform_reply_content ?? null
                      }
                      writtenAt={review.written_at ?? null}
                    />
                  </div>
                  {review.menus && review.menus.length > 0 && (
                    <p className="mb-1 text-xs text-muted-foreground">
                      {review.menus.join(", ")}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">
                    {review.content ?? "(내용 없음)"}
                  </p>
                  {review.images && review.images.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {review.images.slice(0, 3).map((img, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={(ev) => {
                            ev.preventDefault();
                            setImageModal({ images: review.images!, index: i });
                          }}
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
                </div>
                <ReplyContentBlock
                  review={review}
                  canEdit={
                    !isReplyExpired(review.written_at ?? null) &&
                    !review.platform_reply_content
                  }
                  isCreating={isCreatingDraft(review.id)}
                  onCreateDraft={(id) => createDraft.mutate({ reviewId: id })}
                  onCreateDraftWithContent={async (id, draft_content) => {
                    await createDraft.mutateAsync({ reviewId: id, draft_content });
                  }}
                  onUpdateDraft={(id, draft_content, onSuccess) =>
                    updateDraft.mutate(
                      { reviewId: id, draft_content },
                      { onSuccess },
                    )
                  }
                  onApprove={(id, approved_content) => {
                    approveReply.mutate(
                      { reviewId: id, approved_content },
                      {
                        onSuccess: () => {
                          if (
                            ["baemin", "yogiyo", "ddangyo", "coupang_eats"].includes(
                              review.platform,
                            )
                          ) {
                            registerReply.mutate({
                              reviewId: id,
                              storeId: review.store_id,
                              content: approved_content,
                            });
                          }
                        },
                      },
                    );
                  }}
                  onDelete={(id) => deleteDraft.mutate({ reviewId: id })}
                  onDeleted={(id) => skipAutoCreateRef.current.add(id)}
                  isUpdating={isUpdatingDraft}
                  isApproving={isApprovingReply}
                  isDeleting={isDeletingDraft}
                />
              </li>
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
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-foreground">전체 {count}건</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!effectiveStoreId || isSyncingDdangyo) return;
              const controller = new AbortController();
              syncDdangyoAbortRef.current = controller;
              syncDdangyo({
                storeId: effectiveStoreId,
                signal: controller.signal,
              } as SyncDdangyoReviewsVariables);
            }}
            disabled={!effectiveStoreId || isSyncingDdangyo}
            className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isSyncingDdangyo ? "리뷰 동기화 중…" : "리뷰 동기화"}
          </button>
        </div>
      )}

      {platform === "yogiyo" && linkedStores.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-foreground">전체 {count}건</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!effectiveStoreId || isSyncingYogiyo) return;
              const controller = new AbortController();
              syncYogiyoAbortRef.current = controller;
              syncYogiyo({
                storeId: effectiveStoreId,
                signal: controller.signal,
              } as SyncYogiyoReviewsVariables);
            }}
            disabled={!effectiveStoreId || isSyncingYogiyo}
            className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isSyncingYogiyo ? "리뷰 동기화 중…" : "리뷰 동기화"}
          </button>
        </div>
      )}

      {platform === "coupang_eats" && linkedStores.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
            <span className="text-foreground">전체 {count}건</span>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!effectiveStoreId || isSyncingCoupangEats) return;
              const controller = new AbortController();
              syncCoupangEatsAbortRef.current = controller;
              syncCoupangEats({
                storeId: effectiveStoreId,
                signal: controller.signal,
              } as SyncCoupangEatsReviewsVariables);
            }}
            disabled={!effectiveStoreId || isSyncingCoupangEats}
            className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {isSyncingCoupangEats ? "리뷰 동기화 중…" : "리뷰 동기화"}
          </button>
        </div>
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
                  <li
                    key={review.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {(review.platform === "ddangyo" || review.platform === "yogiyo" || review.platform === "coupang_eats") && review.author_name
                          ? review.author_name
                          : (PLATFORM_LABEL[review.platform] ?? review.platform)}
                      </span>
                      {review.rating != null && (
                        <span className="text-sm font-medium">
                          {review.rating}점
                        </span>
                      )}
                      {review.written_at != null && (
                        <span className="text-xs text-muted-foreground">
                          {review.written_at.slice(0, 10)}
                        </span>
                      )}
                      <ReplyStatusBadge
                        platformReplyContent={
                          review.platform_reply_content ?? null
                        }
                        writtenAt={review.written_at ?? null}
                      />
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
                            onClick={() =>
                              setImageModal({
                                images: review.images!,
                                index: i,
                              })
                            }
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
                    <ReplyContentBlock
                      review={review}
                      canEdit={
                        !isReplyExpired(review.written_at ?? null) &&
                        !review.platform_reply_content
                      }
                      isCreating={isCreatingDraft(review.id)}
                      onCreateDraft={(id) =>
                        createDraft.mutate({ reviewId: id })
                      }
                      onCreateDraftWithContent={async (id, draft_content) => {
                        await createDraft.mutateAsync({ reviewId: id, draft_content });
                      }}
                      onUpdateDraft={(id, draft_content, onSuccess) =>
                        updateDraft.mutate(
                          { reviewId: id, draft_content },
                          { onSuccess },
                        )
                      }
                      onApprove={(id, approved_content) => {
                        approveReply.mutate(
                          { reviewId: id, approved_content },
                          {
                            onSuccess: () => {
                              if (
                                ["baemin", "yogiyo", "ddangyo", "coupang_eats"].includes(
                                  review.platform,
                                )
                              ) {
                                registerReply.mutate({
                                  reviewId: id,
                                  storeId: review.store_id,
                                  content: approved_content,
                                });
                              }
                            },
                          },
                        );
                      }}
                      onDelete={(id) => deleteDraft.mutate({ reviewId: id })}
                      onDeleted={(id) => skipAutoCreateRef.current.add(id)}
                      isUpdating={isUpdatingDraft}
                      isApproving={isApprovingReply}
                      isDeleting={isDeletingDraft}
                    />
                  </li>
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
      {(isSyncing || isSyncingDdangyo || isSyncingYogiyo || isSyncingCoupangEats) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          aria-modal
          aria-labelledby="sync-overlay-title"
        >
          <div className="rounded-lg border border-border bg-background p-6 shadow-lg">
            <p id="sync-overlay-title" className="mb-4 font-medium">
              {isSyncing ? "리뷰 동기화 중… (1~2분 소요)" : isSyncingCoupangEats ? "리뷰 동기화 중…" : "리뷰 동기화 중…"}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              완료될 때까지 다른 페이지로 이동할 수 없습니다.
            </p>
          </div>
        </div>
      )}
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
