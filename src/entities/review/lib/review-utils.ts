import type { ReviewData } from "@/entities/review/types";

/** 요기요 테스트용: 일시적으로 4개월(120일)까지 답글 허용. 나중에 14일로 복구. */
export const REPLY_EXPIRE_DAYS_YOGIYO = 120;
export const REPLY_EXPIRE_DAYS_DEFAULT = 14;

export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function isReplyExpired(
  writtenAt: string | null,
  platform?: string,
): boolean {
  if (!writtenAt) return false;
  const written = new Date(writtenAt).getTime();
  const days =
    platform === "yogiyo" ? REPLY_EXPIRE_DAYS_YOGIYO : REPLY_EXPIRE_DAYS_DEFAULT;
  const deadline = written + days * 24 * 60 * 60 * 1000;
  return Date.now() > deadline;
}

export function getDisplayReplyContent(review: ReviewData): string | null {
  if (review.platform_reply_content) return review.platform_reply_content;
  const d = review.reply_draft;
  if (d?.approved_content) return d.approved_content;
  if (d?.draft_content) return d.draft_content;
  return null;
}
