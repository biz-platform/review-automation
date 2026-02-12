"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getReview } from "@/entities/review/api/review-api";

export function useReview(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEY.review.detail(id ?? ""),
    queryFn: () => getReview({ id: id! }),
    enabled: !!id,
  });
}
