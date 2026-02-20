"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useReview } from "@/entities/review/hooks/query/use-review";
import { useCollectReviews } from "@/entities/review/hooks/mutation/use-collect-reviews";
import { useCreateReplyDraft } from "@/entities/reply/hooks/mutation/use-create-reply-draft";
import { useApproveReply } from "@/entities/reply/hooks/mutation/use-approve-reply";

const PLATFORM_LABEL: Record<string, string> = {
  naver: "네이버",
  baemin: "배민",
  yogiyo: "요기요",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
};

export default function ReviewDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const { data: review, isLoading, error } = useReview(id);
  const collectReviews = useCollectReviews();
  const createDraft = useCreateReplyDraft();
  const approveReply = useApproveReply();

  const [approvedContent, setApprovedContent] = useState("");
  const [draftResult, setDraftResult] = useState<string | null>(null);

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error || !review)
    return <p className="p-8 text-red-600">리뷰를 찾을 수 없습니다.</p>;

  const displayContent = approvedContent ?? draftResult ?? "";
  const canApprove = displayContent.trim().length > 0;

  async function handleCollect() {
    try {
      await collectReviews.mutateAsync({ reviewId: id });
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateDraft() {
    try {
      const result = await createDraft.mutateAsync({ reviewId: id });
      setDraftResult(result.draft_content);
      setApprovedContent(result.draft_content);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleApprove() {
    if (!canApprove) return;
    try {
      await approveReply.mutateAsync({
        reviewId: id,
        approved_content: displayContent,
      });
      setDraftResult(null);
      setApprovedContent("");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link href="/reviews" className="text-muted-foreground hover:underline">
          ← 리뷰 목록
        </Link>
      </div>

      <section className="mb-8 rounded-lg border border-border p-6">
        <h1 className="mb-4 text-xl font-bold">리뷰</h1>
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {PLATFORM_LABEL[review.platform] ?? review.platform}
          </span>
          {review.rating != null && (
            <span className="font-medium">{review.rating}점</span>
          )}
          {review.author_name && (
            <span className="text-sm text-muted-foreground">
              {review.author_name}
            </span>
          )}
        </div>
        <p className="whitespace-pre-wrap">{review.content ?? "(내용 없음)"}</p>
      </section>

      <section className="mb-8 flex flex-wrap gap-4">
        <button
          type="button"
          onClick={handleCollect}
          disabled={collectReviews.isPending}
          className="rounded-md border border-border px-4 py-2 disabled:opacity-50"
        >
          {collectReviews.isPending ? "수집 중…" : "수집 (Mock)"}
        </button>
        <button
          type="button"
          onClick={handleCreateDraft}
          disabled={createDraft.isPending}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
        >
          {createDraft.isPending ? "생성 중…" : "AI 초안 생성"}
        </button>
      </section>

      {(draftResult != null || displayContent) && (
        <section className="mb-8 rounded-lg border border-border p-6">
          <h2 className="mb-4 text-lg font-bold">답글 초안 / 승인 내용</h2>
          <textarea
            value={displayContent}
            onChange={(e) => setApprovedContent(e.target.value)}
            rows={6}
            className="mb-4 w-full rounded-md border border-border px-3 py-2"
            placeholder="수정 후 승인 버튼을 누르세요."
          />
          <button
            type="button"
            onClick={handleApprove}
            disabled={!canApprove || approveReply.isPending}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
          >
            {approveReply.isPending ? "전송 중…" : "승인 후 전송 (Mock)"}
          </button>
        </section>
      )}
    </div>
  );
}
