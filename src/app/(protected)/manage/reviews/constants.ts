import type { ReviewListFilter } from "@/entities/review/types";

/** 댓글 관리에서 연동 가능한 플랫폼 (store_platform_sessions 기준) */
export const PLATFORMS_LINKED = [
  "baemin",
  "ddangyo",
  "yogiyo",
] as const;

export type PlatformLinked = (typeof PLATFORMS_LINKED)[number];

/** 필터별 count 쿼리용 값 */
export const REVIEW_FILTER_VALUES: ReviewListFilter[] = [
  "all",
  "unanswered",
  "answered",
  "expired",
];

export const REVIEW_FILTER_TABS: { value: ReviewListFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unanswered", label: "미답변" },
  { value: "answered", label: "답변완료" },
  { value: "expired", label: "기한만료" },
];

/** 기간 필터: 일 단위 기준 (오늘 0시 기준) */
export const PERIOD_FILTER_OPTIONS = [
  { value: "all", label: "전체 (최근 6개월)", days: 180 },
  { value: "90", label: "최근 3개월", days: 90 },
  { value: "14", label: "최근 2주", days: 14 },
  { value: "7", label: "최근 1주", days: 7 },
  { value: "1", label: "오늘", days: 1 },
] as const;

export type PeriodFilterValue = (typeof PERIOD_FILTER_OPTIONS)[number]["value"];

/** 별점 필터 */
export const STAR_RATING_OPTIONS = [
  { value: "all", label: "별점 전체" },
  { value: "5", label: "5점" },
  { value: "4", label: "4점" },
  { value: "3", label: "3점" },
  { value: "2", label: "2점" },
  { value: "1", label: "1점" },
] as const;

export type StarRatingFilterValue = (typeof STAR_RATING_OPTIONS)[number]["value"];
