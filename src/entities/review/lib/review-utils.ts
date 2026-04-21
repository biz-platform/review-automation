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

/** 사장님(가게) 플랫폼 답글 존재 (운영자 본문과 동일한 중복 필드는 제외) */
export function hasShopPlatformReplyContent(
  review: Pick<
    ReviewData,
    "platform_reply_content" | "platform_operator_reply_content"
  >,
): boolean {
  const shop = review.platform_reply_content?.trim() ?? "";
  if (!shop) return false;
  const op = review.platform_operator_reply_content?.trim() ?? "";
  if (op !== "" && shop === op) return false;
  return true;
}

/** 배민 운영자 등 비가게 노출 답글만 있음 (사장님 답은 없음) */
export function hasOperatorOnlyPlatformReply(
  review: Pick<ReviewData, "platform_reply_content" | "platform_operator_reply_content">,
): boolean {
  return (
    !hasShopPlatformReplyContent(review) &&
    Boolean(review.platform_operator_reply_content?.trim())
  );
}

/**
 * 리뷰관리에서 "답변완료"로 볼 조건: 사장님 답 또는 운영자 답 중 하나라도 있으면 true.
 * 미답변 필터·배지·초안/등록 차단에 사용.
 */
export function isReviewManageAnswered(
  review: Pick<ReviewData, "platform_reply_content" | "platform_operator_reply_content">,
): boolean {
  return (
    hasShopPlatformReplyContent(review) ||
    Boolean(review.platform_operator_reply_content?.trim())
  );
}

/**
 * 노출 본문: 플랫폼에 실제 등록된 운영자 답은 `platform_operator_reply_content` 그대로.
 * 사장님 답과 문자열이 동일한 중복 저장(레거시·API)이면 운영자 쪽을 노출해 초안과 섞이지 않게 함.
 */
export function getDisplayReplyContent(review: ReviewData): string | null {
  const shop = review.platform_reply_content?.trim() ?? "";
  const operator = review.platform_operator_reply_content?.trim() ?? "";
  if (shop && operator && shop !== operator) {
    return shop;
  }
  if (operator) return operator;
  if (shop) return shop;
  const d = review.reply_draft;
  if (d?.approved_content) return d.approved_content;
  if (d?.draft_content) return d.draft_content;
  return null;
}
