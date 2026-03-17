"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";

const ME_JOBS_URL = "/api/me/jobs?limit=30";
const POLL_INTERVAL_MS = 5_000;
const MAX_SEEN_IDS = 100;

function isRegisterReplyType(type: string): boolean {
  return type.endsWith("_register_reply");
}

/** 워커가 register_reply job을 completed 처리했을 때만 review 쿼리 무효화 (필터 숫자·목록 갱신) */
export function useInvalidateReviewOnRegisterReplyComplete() {
  const queryClient = useQueryClient();
  const seenCompletedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof document === "undefined") return;

    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      try {
        const res = await fetch(ME_JOBS_URL, { credentials: "same-origin" });
        if (!res.ok) return;
        const data = await res.json();
        const jobs = (data?.result ?? []) as { id: string; type: string; status: string }[];
        const seen = seenCompletedIdsRef.current;
        for (const job of jobs) {
          if (
            job.status === "completed" &&
            isRegisterReplyType(job.type) &&
            !seen.has(job.id)
          ) {
            seen.add(job.id);
            if (seen.size > MAX_SEEN_IDS) {
              const first = seen.values().next().value;
              if (first != null) seen.delete(first);
            }
            queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
            break;
          }
        }
      } catch {
        // ignore
      }
    };

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(poll, POLL_INTERVAL_MS);
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    if (document.visibilityState === "visible") startPolling();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") startPolling();
      else stopPolling();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [queryClient]);
}
