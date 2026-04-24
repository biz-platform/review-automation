import type { ReviewListFilter } from "@/entities/review/types";

export {
  PLATFORMS_LINKED,
  type PlatformLinked,
} from "@/lib/reviews/platform-linked";

/** 필터별 count 쿼리용 값 */
export const REVIEW_FILTER_VALUES: ReviewListFilter[] = [
  "all",
  "unanswered",
  "answered",
  "expired",
];

export const REVIEW_FILTER_TABS: { value: ReviewListFilter; label: string }[] =
  [
    { value: "all", label: "전체" },
    { value: "unanswered", label: "미답변" },
    { value: "answered", label: "답변완료" },
    { value: "expired", label: "기한만료" },
  ];

/** 기간 필터: 일 단위 기준 (오늘 0시 기준) */
export const PERIOD_FILTER_OPTIONS = [
  { value: "all", label: "전체 (최근 6개월)", days: 180 },
  { value: "90", label: "최근 3개월", days: 90 },
  { value: "30", label: "최근 1개월", days: 30 },
  { value: "7", label: "최근 1주", days: 7 },
  { value: "1", label: "오늘", days: 1 },
] as const;

export type PeriodFilterValue = (typeof PERIOD_FILTER_OPTIONS)[number]["value"];

/** 별점 필터 */
export const STAR_RATING_OPTIONS = [
  { value: "all", label: "별점 전체" },
  { value: "5", label: "5점" },
  { value: "4", label: "4점" },
  { value: "lte3", label: "3점 이하" },
] as const;

export type StarRatingFilterValue =
  (typeof STAR_RATING_OPTIONS)[number]["value"];

/** 필터 적용 후 목록이 이 개수 미만이면, 스크롤 없이 다음 페이지를 최대 {@link REVIEW_MANAGE_AUTO_PREFETCH_MAX_ATTEMPTS}회까지 요청 */
export const REVIEW_MANAGE_AUTO_PREFETCH_MIN_ITEMS = 10;

/** 일반 별점·전체: 최소 개수 채울 때까지(상한) */
export const REVIEW_MANAGE_AUTO_PREFETCH_MAX_ATTEMPTS = 8;

/**
 * `lte3`는 페이지당 매칭이 적어서, 클라이언트 필터 기준 “전부”에 가깝게 쌓이려면
 * {@link REVIEW_MANAGE_AUTO_PREFETCH_MIN_ITEMS} 도달 후에도 `hasNext`인 동안 더 당겨야 함.
 * (무한 방지 상한)
 */
export const REVIEW_MANAGE_AUTO_PREFETCH_LTE3_MAX_ATTEMPTS = 150;

const STAR_RATING_PARAM_VALUES = STAR_RATING_OPTIONS.map(
  (o) => o.value,
) as readonly string[];

/** URL 쿼리 `star` 파싱 (알림톡 딥링크 등) */
export function parseStarFilterSearchParam(
  raw: string | null,
): StarRatingFilterValue {
  const v = raw?.trim() ?? "";
  if (!v) return "all";
  if (STAR_RATING_PARAM_VALUES.includes(v)) return v as StarRatingFilterValue;
  return "all";
}
