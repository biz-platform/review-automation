import type { ReviewData } from "@/entities/review/types";

/** 댓글 작성 가능 기한(일). 리뷰 작성일 기준. */
export const REPLY_WRITE_DEADLINE_DAYS = 14;
/**
 * 쿠팡이츠 자동/수동 답글 시도용 기한(일).
 * 플랫폼은 2주(14일) 정책이나 경계·타임존으로 20051이 나기 쉬워 1일 여유를 둔다.
 */
export const COUPANG_EATS_REPLY_WRITE_DEADLINE_DAYS = 13;
/** 댓글 수정/삭제 가능 기한(일). 리뷰 작성일 기준. */
export const REPLY_EDIT_DEADLINE_DAYS = 14;

export function getReplyWriteDeadlineDays(platform?: string | null): number {
  if (platform === "coupang_eats") {
    return COUPANG_EATS_REPLY_WRITE_DEADLINE_DAYS;
  }
  return REPLY_WRITE_DEADLINE_DAYS;
}

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** 댓글 작성 기한 초과 여부. 쿠팡이츠는 {@link COUPANG_EATS_REPLY_WRITE_DEADLINE_DAYS}일. */
export function isReplyWriteExpired(
  writtenAt: string | null,
  platform?: string | null,
): boolean {
  if (!writtenAt) return false;
  const written = new Date(writtenAt).getTime();
  const days = getReplyWriteDeadlineDays(platform);
  const deadline = written + days * 24 * 60 * 60 * 1000;
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
