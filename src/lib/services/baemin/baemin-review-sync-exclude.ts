/**
 * 배민 셀프 UI·API에서 노출 제한·숨김 리뷰 처리.
 * self-api `GET /v1/review/shops/{shopNo}/reviews` 응답 필드 기준:
 * - `blockMessage`: 비면 정상, 문구 있으면 숨김/제재 안내
 * - `displayStatus`: 일반 노출 `"DISPLAY"`, 의심·숨김 등은 `"ABUSE_BLOCK"` 등
 * - `writableComment`: 댓글 작성 가능 여부(ABUSE_BLOCK 예시에서는 false)
 *
 * sync 시 DB에 넣지 않고, 답글 자동화 시 원문보기 후에도 등록 불가면 실패 처리.
 */
export const BAEMIN_HIDDEN_REVIEW_CONTENT_PATTERN =
  /허위\s*리뷰|허위리뷰|숨김\s*처리|숨김처리|의심되어\s*숨김|의심되어\s*숨김처리/i;

/** 답글 등록 불가 안내(사용자·로그용) */
export const BAEMIN_HIDDEN_REVIEW_REPLY_BLOCKED_MESSAGE =
  "배민에서 허위 리뷰 의심·숨김 처리된 리뷰입니다. 원문 확인 후에도 사장님 댓글을 등록할 수 없으면 배민 정책에 따른 제한일 수 있습니다.";

/** API `displayStatus`가 일반 고객 리뷰 노출 */
export const BAEMIN_REVIEW_DISPLAY_STATUS_NORMAL = "DISPLAY";

export function isBaeminReviewExcludedFromSync(review: unknown): boolean {
  if (review == null || typeof review !== "object") return false;
  const r = review as Record<string, unknown>;

  const blockMessage =
    typeof r.blockMessage === "string" ? r.blockMessage.trim() : "";
  if (blockMessage.length > 0) return true;

  const displayStatus =
    typeof r.displayStatus === "string" ? r.displayStatus.trim() : "";
  if (
    displayStatus.length > 0 &&
    displayStatus !== BAEMIN_REVIEW_DISPLAY_STATUS_NORMAL
  ) {
    return true;
  }

  const contents = typeof r.contents === "string" ? r.contents : "";
  if (contents && BAEMIN_HIDDEN_REVIEW_CONTENT_PATTERN.test(contents)) {
    return true;
  }

  if (r.blinded === true || r.isBlinded === true) return true;
  if (r.hidden === true || r.isHidden === true) return true;
  if (r.blocked === true || r.isBlocked === true) return true;

  return false;
}

export function filterBaeminReviewsForSync(reviews: unknown[]): unknown[] {
  return reviews.filter((item) => !isBaeminReviewExcludedFromSync(item));
}

export function baeminReviewRowLooksMaskedReplyBlocked(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (BAEMIN_HIDDEN_REVIEW_CONTENT_PATTERN.test(t)) return true;
  if (/원문보기/.test(t) && /숨김|허위|의심/.test(t)) return true;
  return false;
}
