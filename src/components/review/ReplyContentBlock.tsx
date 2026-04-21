"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  PLATFORMS_WITH_REPLY_MODIFY_DELETE,
  type PlatformIdWithReply,
} from "@/const/platform";
import type { ReviewData } from "@/entities/review/types";
import {
  getDisplayReplyContent,
  hasOperatorOnlyPlatformReply,
  hasShopPlatformReplyContent,
  isReplyEditExpired,
  isReplyWriteExpired,
  isReviewManageAnswered,
} from "@/entities/review/lib/review-utils";

export interface ReplyContentBlockProps {
  review: ReviewData;
  canEdit: boolean;
  isCreating: boolean;
  onCreateDraft: (reviewId: string) => void;
  onCreateDraftWithContent?: (
    reviewId: string,
    draft_content: string,
  ) => void | Promise<void>;
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
  onModifyPlatformReply?: (reviewId: string, content: string) => void;
  onDeletePlatformReply?: (reviewId: string) => void;
  isModifyingPlatform?: (reviewId: string) => boolean;
  isDeletingPlatform?: (reviewId: string) => boolean;
  /** true면 카드 내 "바로 등록" 버튼 숨김 (하단 등록하기로 일괄 등록 시) */
  hideInlineRegister?: boolean;
}

export function ReplyContentBlock({
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
  onModifyPlatformReply,
  onDeletePlatformReply,
  isModifyingPlatform,
  isDeletingPlatform,
  hideInlineRegister,
}: ReplyContentBlockProps) {
  const content = getDisplayReplyContent(review);
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState("");
  const [deletePlatformModalOpen, setDeletePlatformModalOpen] = useState(false);
  const [deleteDraftModalOpen, setDeleteDraftModalOpen] = useState(false);
  const withinEditPeriod = !isReplyEditExpired(
    review.written_at ?? null,
    review.platform,
  );
  const hasShopReply = hasShopPlatformReplyContent(review);
  const operatorOnly = hasOperatorOnlyPlatformReply(review);
  const isDraftOnly =
    content != null &&
    !hasShopReply &&
    !operatorOnly &&
    Boolean(
      review.reply_draft?.approved_content?.trim() ||
        review.reply_draft?.draft_content?.trim(),
    );
  const jobPending =
    !!isModifyingPlatform?.(review.id) ||
    !!isDeletingPlatform?.(review.id) ||
    isApproving(review.id);
  const supportsPlatformModify =
    hasShopReply &&
    PLATFORMS_WITH_REPLY_MODIFY_DELETE.includes(
      review.platform as PlatformIdWithReply,
    ) &&
    onModifyPlatformReply != null &&
    onDeletePlatformReply != null;

  /** AI 추천 댓글 카드 스타일: 흰색 배경, 얇은 테두리 */
  const draftCardClass = "rounded-lg border border-gray-07 bg-white p-4";
  /** 삭제 버튼 스타일: 빨간 배경 + outline, 호버 시 ghost 스타일 덮어써서 선명하게 */
  const deleteButtonClass =
    "border-0 bg-red-500 text-white outline outline-1 outline-offset-[-1px] outline-red-600 text-xs font-medium [&:not(:disabled)]:hover:!bg-red-600 [&:not(:disabled)]:hover:!opacity-100";

  if (content && !isEditing) {
    return (
      <>
        {/* AI 추천 댓글 카드: 높이 제한·스크롤 없음 */}
        <div>
          <div className={draftCardClass}>
            {hasShopReply ? (
              <span className="typo-body-03-regular mb-2 block text-gray-05">
                플랫폼 등록 답글
              </span>
            ) : operatorOnly ? (
              <span className="typo-body-03-regular mb-2 block text-gray-05">
                배민 운영자 답글 (읽기 전용)
              </span>
            ) : (
              <span className="typo-body-03-regular mb-2 block text-gray-05">
                AI 추천 댓글
              </span>
            )}
            <p className="typo-body-02-regular whitespace-pre-wrap text-gray-01">
              {content}
            </p>
          </div>
        </div>
        {hasShopReply && withinEditPeriod && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {supportsPlatformModify ? (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeletePlatformModalOpen(true)}
                  disabled={jobPending}
                  className={deleteButtonClass}
                >
                  {isDeletingPlatform?.(review.id) ? "삭제 중…" : "삭제"}
                </Button>
                <Modal
                  open={deletePlatformModalOpen}
                  onOpenChange={(open) => !open && setDeletePlatformModalOpen(false)}
                  title="답글 삭제"
                  description="플랫폼에 등록된 답글을 삭제할까요?"
                  footer={
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeletePlatformModalOpen(false)}
                        className="text-xs"
                      >
                        취소
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onDeletePlatformReply(review.id);
                          setDeletePlatformModalOpen(false);
                        }}
                        disabled={jobPending}
                        className={deleteButtonClass}
                      >
                        {isDeletingPlatform?.(review.id) ? "삭제 중…" : "삭제"}
                      </Button>
                    </>
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setLocalContent(content);
                    setIsEditing(true);
                  }}
                  disabled={jobPending}
                  className="text-xs"
                >
                  {isModifyingPlatform?.(review.id) ? "수정 중…" : "수정"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteDraftModalOpen(true)}
                  disabled={jobPending || isDeleting(review.id)}
                  className={deleteButtonClass}
                >
                  {isDeleting(review.id) ? "삭제 중…" : "삭제"}
                </Button>
                <Modal
                  open={deleteDraftModalOpen}
                  onOpenChange={(open) => !open && setDeleteDraftModalOpen(false)}
                  title="답글 삭제"
                  description="답글을 삭제할까요?"
                  footer={
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setDeleteDraftModalOpen(false)}
                        className="text-xs"
                      >
                        취소
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onDelete(review.id);
                          onDeleted(review.id);
                          setDeleteDraftModalOpen(false);
                        }}
                        disabled={jobPending || isDeleting(review.id)}
                        className={deleteButtonClass}
                      >
                        {isDeleting(review.id) ? "삭제 중…" : "삭제"}
                      </Button>
                    </>
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (onCreateDraftWithContent) {
                      await onCreateDraftWithContent(review.id, content);
                    }
                    setLocalContent(content);
                    setIsEditing(true);
                  }}
                  disabled={jobPending}
                  className="text-xs"
                >
                  수정
                </Button>
              </>
            )}
          </div>
        )}

        {isDraftOnly && canEdit && (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onDelete(review.id);
                onDeleted(review.id);
                onCreateDraft(review.id);
              }}
              disabled={jobPending || isDeleting(review.id) || isCreating}
              className="text-xs"
            >
              {isCreating ? "재생성 중…" : "재생성"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setLocalContent(content);
                setIsEditing(true);
              }}
              disabled={jobPending}
              className="text-xs"
            >
              수정
            </Button>
            {!hideInlineRegister && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => onApprove(review.id, content)}
                disabled={jobPending}
                className="text-xs"
              >
                {isApproving(review.id) ? "전송중…" : "바로 등록"}
              </Button>
            )}
          </div>
        )}
      </>
    );
  }

  if (content && isEditing) {
    const isPlatformEdit = hasShopReply && supportsPlatformModify;
    return (
      <div className={draftCardClass}>
        <textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          rows={3}
          className="typo-body-02-regular mb-3 w-full rounded-lg border border-gray-07 bg-gray-08/50 px-3 py-2 text-gray-01 outline-none focus:border-gray-06 focus:ring-1 focus:ring-gray-06"
        />
        <div className="flex justify-end gap-2">
          {isPlatformEdit ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                onModifyPlatformReply?.(review.id, localContent.trim());
                setIsEditing(false);
              }}
              disabled={jobPending || !localContent.trim()}
              className="text-xs"
            >
              {isModifyingPlatform?.(review.id) ? "수정 반영 중…" : "수정 반영"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                onUpdateDraft(review.id, localContent, () =>
                  setIsEditing(false),
                )
              }
              disabled={
                jobPending || isUpdating(review.id) || !localContent.trim()
              }
              className="text-xs"
            >
              {isUpdating(review.id) ? "저장 중…" : "저장"}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsEditing(false)}
            className="text-xs"
          >
            취소
          </Button>
        </div>
      </div>
    );
  }

  const writeExpired = isReplyWriteExpired(
    review.written_at ?? null,
    review.platform,
  );
  if (writeExpired) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        기한이 만료되어 댓글을 작성할 수 없습니다.
      </p>
    );
  }

  if (isReviewManageAnswered(review)) {
    return (
      <p className="mt-2 text-xs text-muted-foreground">
        플랫폼 답변이 반영되어 이 리뷰에서는 AI 초안을 만들거나 수정할 수 없습니다.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-gray-07 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="typo-body-02-regular text-gray-05">
          {isCreating ? "초안 생성 중…" : "초안 없음"}
        </span>
        {!isCreating && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onCreateDraft(review.id)}
            disabled={jobPending}
            className="text-xs"
          >
            AI 초안 생성
          </Button>
        )}
      </div>
    </div>
  );
}
