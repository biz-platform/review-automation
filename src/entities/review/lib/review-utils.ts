import type { ReviewData } from "@/entities/review/types";

/** 댓글 작성 가능 기한(일). 리뷰 작성일 기준. */
export const REPLY_WRITE_DEADLINE_DAYS = 14;
/** 댓글 수정/삭제 가능 기한(일). 리뷰 작성일 기준. */
export const REPLY_EDIT_DEADLINE_DAYS = 14;

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** 댓글 작성 기한 초과 여부 (작성: 14일) */
export function isReplyWriteExpired(
  writtenAt: string | null,
  _platform?: string,
): boolean {
  if (!writtenAt) return false;
  const written = new Date(writtenAt).getTime();
  const deadline = written + REPLY_WRITE_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > deadline;
}

/** 댓글 수정/삭제 기한 초과 여부 (수정·삭제: 14일) */
export function isReplyEditExpired(
  writtenAt: string | null,
  _platform?: string,
): boolean {
  if (!writtenAt) return false;
  const written = new Date(writtenAt).getTime();
  const deadline = written + REPLY_EDIT_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() > deadline;
}

/** @deprecated 댓글 작성 기한 초과 여부. isReplyWriteExpired 사용 권장. */
export function isReplyExpired(
  writtenAt: string | null,
  platform?: string,
): boolean {
  return isReplyWriteExpired(writtenAt, platform);
}

export function getDisplayReplyContent(review: ReviewData): string | null {
  if (review.platform_reply_content) return review.platform_reply_content;
  const d = review.reply_draft;
  if (d?.approved_content) return d.approved_content;
  if (d?.draft_content) return d.draft_content;
  return null;
}
