"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useReviewList } from "@/entities/review/hooks/query/use-review-list";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useSyncBaeminReviews } from "@/entities/store/hooks/mutation/use-sync-baemin-reviews";

const PLATFORM_TABS = [
  { value: "", label: "전체 플랫폼" },
  { value: "baedal", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "yogiyo", label: "요기요" },
  { value: "danggeoyo", label: "땡겨요" },
  { value: "naver", label: "네이버" },
] as const;

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  baedal: "배달의민족",
  yogiyo: "요기요",
  coupang_eats: "쿠팡이츠",
  danggeoyo: "땡겨요",
};

export default function ReviewsManagePage() {
  const searchParams = useSearchParams();
  const platform = searchParams.get("platform") ?? "";
  const linkedOnly = !!platform;

  const { data: storeListData, isLoading: storesLoading } = useStoreList(
    platform === "baedal" ? "baedal" : undefined
  );
  const linkedStores = platform === "baedal" ? (storeListData ?? []) : [];
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  useEffect(() => {
    if (linkedStores.length > 0 && !linkedStores.some((s) => s.id === selectedStoreId)) {
      setSelectedStoreId(linkedStores[0].id);
    }
  }, [linkedStores, selectedStoreId]);
  const effectiveStoreId =
    selectedStoreId && linkedStores.some((s) => s.id === selectedStoreId)
      ? selectedStoreId
      : linkedStores[0]?.id ?? null;

  const isBaedal = platform === "baedal";
  const showLinkPrompt =
    isBaedal && !storesLoading && linkedStores.length === 0;

  const { data: baeminDbData, isLoading: baeminListLoading } = useReviewList(
    isBaedal && effectiveStoreId
      ? { store_id: effectiveStoreId, platform: "baedal", limit: 100, offset: 0 }
      : { limit: 1, offset: 0 }
  );

  const baeminDbList = (isBaedal ? baeminDbData?.result : []) ?? [];
  const countAll = isBaedal ? (baeminDbData?.count ?? 0) : 0;

  const { mutate: syncBaemin, isPending: isSyncing } = useSyncBaeminReviews();

  const { data, isLoading } = useReviewList({
    platform: platform && platform !== "baedal" ? platform : undefined,
    linked_only: linkedOnly && platform !== "baedal",
    limit: 50,
    offset: 0,
  });

  const list = data?.result ?? [];
  const count = data?.count ?? 0;

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

      {showLinkPrompt && (
        <div className="mb-6 rounded-lg border border-border bg-muted/50 p-6 text-center">
          <p className="mb-4 text-muted-foreground">
            배달의민족 연동된 매장이 없습니다.
          </p>
          <Link
            href="/stores?accounts=1&platform=baedal"
            className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
          >
            매장 계정 연동하기
          </Link>
        </div>
      )}

      {isBaedal && linkedStores.length > 0 && (
        <>
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
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <span className="text-foreground">전체 {countAll}건</span>
            </div>
            <button
              type="button"
              onClick={() => effectiveStoreId && syncBaemin({ storeId: effectiveStoreId })}
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
                <div className="mb-2 flex items-center gap-2">
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
                </div>
                <p className="line-clamp-2">{review.content ?? "(내용 없음)"}</p>
              </li>
            ))}
          </ul>
          {!baeminListLoading && baeminDbList.length === 0 && (
            <p className="text-muted-foreground">
              저장된 리뷰가 없습니다. 위 &quot;리뷰 동기화&quot;를 눌러 배민에서 가져오세요.
            </p>
          )}
        </>
      )}

      {!isBaedal && !showLinkPrompt && (
        <>
          {linkedOnly && linkedStores.length === 0 && (
            <div className="mb-6 rounded-lg border border-border bg-muted/50 p-6 text-center">
              <p className="mb-4 text-muted-foreground">
                {PLATFORM_LABEL[platform] ?? platform} 연동된 매장이 없습니다.
              </p>
              <Link
                href={`/stores?accounts=1&platform=${platform}`}
                className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground"
              >
                매장 계정 연동하기
              </Link>
            </div>
          )}
          {(!linkedOnly || list.length > 0) && (
            <>
              {isLoading && (
                <p className="text-muted-foreground">로딩 중…</p>
              )}
              <ul className="space-y-2">
                {list.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {PLATFORM_LABEL[review.platform] ?? review.platform}
                      </span>
                      {review.rating != null && (
                        <span className="text-sm font-medium">
                          {review.rating}점
                        </span>
                      )}
                    </div>
                    <p className="mb-2 line-clamp-2">
                      {review.content ?? "(내용 없음)"}
                    </p>
                    <Link
                      href={`/reviews/${review.id}`}
                      className="text-sm text-primary hover:underline"
                    >
                      상세 보기
                    </Link>
                  </li>
                ))}
              </ul>
              {!isLoading && list.length === 0 && (
                <p className="text-muted-foreground">리뷰가 없습니다.</p>
              )}
              <p className="mt-4 text-sm text-muted-foreground">
                총 {count}건
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
