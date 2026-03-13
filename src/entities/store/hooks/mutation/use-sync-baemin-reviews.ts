"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEY } from "@/const/query-keys";
import {
  startSyncBaeminReviews,
  getBrowserJobStatus,
} from "@/entities/store/api/store-api";

const SYNC_JOB_POLL_INTERVAL_MS = 2_000;
const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export type SyncBaeminReviewsVariables = {
  storeId: string;
  signal?: AbortSignal;
  onJobId?: (jobId: string) => void;
};

export function useSyncBaeminReviews() {
  const queryClient = useQueryClient();
  const [syncJob, setSyncJob] = useState<{
    storeId: string;
    jobId: string;
  } | null>(null);
  const mutation = useMutation({
    mutationFn: (params: SyncBaeminReviewsVariables) =>
      startSyncBaeminReviews({
        storeId: params.storeId,
        signal: params.signal,
      }),
    onSuccess: (data, variables) => {
      if (data?.jobId) {
        const job = { storeId: variables.storeId, jobId: data.jobId };
        setSyncJob(job);
        variables.onJobId?.(data.jobId);
        // 첫 폴링 즉시 실행 (useQuery가 활성화되기 전에 캐시 선반입)
        const key = QUERY_KEY.sync.job(job.storeId, job.jobId);
        queryClient.prefetchQuery({
          queryKey: key,
          queryFn: () => getBrowserJobStatus(job.storeId, job.jobId),
        });
      }
    },
  });

  const jobQuery = useQuery({
    queryKey: syncJob
      ? QUERY_KEY.sync.job(syncJob.storeId, syncJob.jobId)
      : ["sync", "job", "disabled"],
    queryFn: () =>
      syncJob
        ? getBrowserJobStatus(syncJob.storeId, syncJob.jobId)
        : Promise.reject(new Error("No sync job")),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]))
        return false;
      return SYNC_JOB_POLL_INTERVAL_MS;
    },
    enabled: !!syncJob,
  });

  useEffect(() => {
    if (!syncJob || !jobQuery.data) return;
    const status = jobQuery.data.status;
    if (!TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]))
      return;

    queryClient.invalidateQueries({ queryKey: QUERY_KEY.review.root });
    queryClient.invalidateQueries({ queryKey: QUERY_KEY.store.list });
    queryClient.refetchQueries({ queryKey: ["review", "list"] });
    queryClient.refetchQueries({ queryKey: QUERY_KEY.store.list });
    setSyncJob(null);
  }, [syncJob, jobQuery.data, queryClient]);

  const isSyncing = mutation.isPending || !!syncJob;

  return {
    ...mutation,
    isPending: isSyncing,
  };
}
