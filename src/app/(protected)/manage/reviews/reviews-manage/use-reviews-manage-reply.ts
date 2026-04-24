"use client";

import { useState, useCallback, useEffect, type MutableRefObject } from "react";
import { useCreateReplyDraft } from "@/entities/reply/hooks/mutation/use-create-reply-draft";
import { useUpdateReplyDraft } from "@/entities/reply/hooks/mutation/use-update-reply-draft";
import { useDeleteReplyDraft } from "@/entities/reply/hooks/mutation/use-delete-reply-draft";
import { useApproveReply } from "@/entities/reply/hooks/mutation/use-approve-reply";
import { useRegisterReply } from "@/entities/reply/hooks/mutation/use-register-reply";
import { useModifyReply } from "@/entities/reply/hooks/mutation/use-modify-reply";
import { useDeleteReply } from "@/entities/reply/hooks/mutation/use-delete-reply";
import { replyPendingCallbacksRef } from "@/entities/reply/lib/reply-pending-callbacks";
import type { ReviewData } from "@/entities/review/types";
import {
  isReplyWriteExpired,
  isReviewManageAnswered,
} from "@/entities/review/lib/review-utils";
import {
  PLATFORMS_WITH_REPLY_MODIFY_DELETE,
  type PlatformIdWithReply,
} from "@/const/platform";
import type { ReplyContentBlockProps } from "@/components/review/ReplyContentBlock";
import { PLATFORMS_LINKED } from "../constants";

export function useReviewsManageReply(
  skipAutoCreateRef: MutableRefObject<Set<string>>,
) {
  const createDraft = useCreateReplyDraft();
  const updateDraft = useUpdateReplyDraft();
  const deleteDraft = useDeleteReplyDraft();
  const approveReply = useApproveReply();
  const registerReply = useRegisterReply();
  const modifyReply = useModifyReply();
  const deleteReply = useDeleteReply();

  const [pendingModifyIds, setPendingModifyIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingRegisterIds, setPendingRegisterIds] = useState<Set<string>>(
    new Set(),
  );
  const [pendingCreateDraftIds, setPendingCreateDraftIds] = useState<Set<string>>(
    new Set(),
  );

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
  const removePendingCreateDraft = useCallback((id: string) => {
    setPendingCreateDraftIds((prev) => {
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
    (reviewId: string) => pendingCreateDraftIds.has(reviewId),
    [pendingCreateDraftIds],
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
      (approveReply.isPending &&
        approveReply.variables?.reviewId === reviewId) ||
      (registerReply.isPending &&
        registerReply.variables?.reviewId === reviewId),
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

  const getReplyBlockProps = useCallback(
    (review: ReviewData): ReplyContentBlockProps => {
      const canEdit =
        !isReplyWriteExpired(review.written_at ?? null, review.platform) &&
        !isReviewManageAnswered(review);
      const supportsModifyDelete = PLATFORMS_WITH_REPLY_MODIFY_DELETE.includes(
        review.platform as PlatformIdWithReply,
      );
      return {
        review,
        canEdit,
        isCreating: isCreatingDraft(review.id),
        onCreateDraft: (id) => {
          setPendingCreateDraftIds((s) => new Set(s).add(id));
          createDraft.mutate(
            { reviewId: id },
            { onSettled: () => removePendingCreateDraft(id) },
          );
        },
        onCreateDraftWithContent: async (id, draft_content) => {
          setPendingCreateDraftIds((s) => new Set(s).add(id));
          await createDraft.mutateAsync({ reviewId: id, draft_content });
          removePendingCreateDraft(id);
        },
        onUpdateDraft: (id, draft_content, onSuccess) =>
          updateDraft.mutate({ reviewId: id, draft_content }, { onSuccess }),
        onApprove: (id, approved_content) => {
          approveReply.mutate(
            { reviewId: id, approved_content },
            {
              onSuccess: () => {
                if (
                  PLATFORMS_LINKED.includes(
                    review.platform as (typeof PLATFORMS_LINKED)[number],
                  )
                ) {
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
        hideInlineRegister: true,
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
      skipAutoCreateRef,
    ],
  );

  const addPendingRegisterIds = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setPendingRegisterIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  return {
    createDraft,
    getReplyBlockProps,
    isCreatingDraft,
    isUpdatingDraft,
    isDeletingDraft,
    isApprovingReply,
    isModifyingPlatform,
    isDeletingPlatform,
    addPendingRegisterIds,
    removePendingRegister,
  };
}
