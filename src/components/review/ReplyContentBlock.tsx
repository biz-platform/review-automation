"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  PLATFORMS_WITH_REPLY_MODIFY_DELETE,
  type PlatformIdWithReply,
} from "@/const/platform";
import type { ReviewData } from "@/entities/review/types";
import {
  getDisplayReplyContent,
  isReplyExpired,
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
}: ReplyContentBlockProps) {
  const content = getDisplayReplyContent(review);
  const [isEditing, setIsEditing] = useState(false);
  const [localContent, setLocalContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const withinTwoWeeks = !isReplyExpired(
    review.written_at ?? null,
    review.platform,
  );
  const hasPlatformReply = !!review.platform_reply_content;
  const isDraftOnly = content != null && !hasPlatformReply;
  const jobPending =
    !!isModifyingPlatform?.(review.id) ||
    !!isDeletingPlatform?.(review.id) ||
    isApproving(review.id);
  const supportsPlatformModify =
    hasPlatformReply &&
    PLATFORMS_WITH_REPLY_MODIFY_DELETE.includes(
      review.platform as PlatformIdWithReply,
    ) &&
    onModifyPlatformReply != null &&
    onDeletePlatformReply != null;

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
            {supportsPlatformModify ? (
              <>
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
                {!deleteConfirm ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirm(true)}
                    disabled={jobPending}
                    className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    {isDeletingPlatform?.(review.id) ? "삭제 중…" : "삭제"}
                  </Button>
                ) : (
                  <>
                    <span className="text-xs text-muted-foreground">
                      플랫폼에서 삭제할까요?
                    </span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        onDeletePlatformReply(review.id);
                        setDeleteConfirm(false);
                      }}
                      disabled={jobPending}
                      className="text-xs"
                    >
                      확인
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setDeleteConfirm(false)}
                      className="text-xs"
                    >
                      취소
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
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
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDelete(review.id);
                    onDeleted(review.id);
                  }}
                  disabled={jobPending || isDeleting(review.id)}
                  className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  {isDeleting(review.id) ? "삭제 중…" : "삭제"}
                </Button>
              </>
            )}
          </div>
        )}

        {isDraftOnly && canEdit && (
          <div className="mt-2 flex flex-wrap gap-1">
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
          </div>
        )}
      </div>
    );
  }

  if (content && isEditing) {
    const isPlatformEdit = hasPlatformReply && supportsPlatformModify;
    return (
      <div className="mt-2 rounded bg-muted/50 p-2">
        <textarea
          value={localContent}
          onChange={(e) => setLocalContent(e.target.value)}
          rows={3}
          className="mb-2 w-full rounded border border-border bg-background px-2 py-1 text-sm"
        />
        <div className="flex gap-1">
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

  const expired = isReplyExpired(review.written_at ?? null, review.platform);
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
  );
}
