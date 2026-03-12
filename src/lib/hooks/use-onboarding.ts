"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getMeOnboarding } from "@/lib/api/me-api";

export function useOnboarding() {
  return useQuery({
    queryKey: QUERY_KEY.me.onboarding,
    queryFn: () => getMeOnboarding(),
  });
}
