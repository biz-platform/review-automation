"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getReviewList } from "@/entities/review/api/review-api";
import type { ReviewListApiRequestData } from "@/entities/review/types";

export function useReviewList(params: ReviewListApiRequestData) {
  return useQuery({
    queryKey: QUERY_KEY.review.list(params),
    queryFn: () => getReviewList(params),
  });
}
