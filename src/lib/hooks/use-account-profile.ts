"use client";

import { useQuery } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import { getMeProfile } from "@/lib/api/me-api";

export function useAccountProfile() {
  return useQuery({
    queryKey: QUERY_KEY.me.profile,
    queryFn: () => getMeProfile(),
  });
}
