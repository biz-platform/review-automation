import type { ReviewListFilter } from "@/entities/review/types";

export const REVIEW_FILTER_TABS: { value: ReviewListFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "unanswered", label: "미답변" },
  { value: "answered", label: "답변완료" },
  { value: "expired", label: "기한만료" },
];
