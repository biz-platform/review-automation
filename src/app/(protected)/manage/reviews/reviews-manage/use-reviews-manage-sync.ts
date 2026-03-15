"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  useSyncBaeminReviews,
  type SyncBaeminReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-baemin-reviews";
import {
  useSyncDdangyoReviews,
  type SyncDdangyoReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-ddangyo-reviews";
import {
  useSyncYogiyoReviews,
  type SyncYogiyoReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-yogiyo-reviews";
import {
  useSyncCoupangEatsReviews,
  type SyncCoupangEatsReviewsVariables,
} from "@/entities/store/hooks/mutation/use-sync-coupang-eats-reviews";
import type { StoreData } from "@/entities/store/types";

type StoreLike = Pick<StoreData, "id">;

export function useReviewsManageSync(
  platform: string,
  effectiveStoreId: string | null,
  storesBaemin: StoreLike[],
  storesDdangyo: StoreLike[],
  storesYogiyo: StoreLike[],
  storesCoupangEats: StoreLike[],
) {
  const {
    mutate: syncBaemin,
    isPending: isSyncing,
    reset: resetSync,
    isError: isSyncError,
    error: syncError,
  } = useSyncBaeminReviews();
  const {
    mutate: syncDdangyo,
    isPending: isSyncingDdangyo,
    reset: resetSyncDdangyo,
    isError: isSyncErrorDdangyo,
    error: syncErrorDdangyo,
  } = useSyncDdangyoReviews();
  const {
    mutate: syncYogiyo,
    isPending: isSyncingYogiyo,
    reset: resetSyncYogiyo,
    isError: isSyncErrorYogiyo,
    error: syncErrorYogiyo,
  } = useSyncYogiyoReviews();
  const {
    mutate: syncCoupangEats,
    isPending: isSyncingCoupangEats,
    reset: resetSyncCoupangEats,
    isError: isSyncErrorCoupangEats,
    error: syncErrorCoupangEats,
  } = useSyncCoupangEatsReviews();

  const syncAbortRef = useRef<AbortController | null>(null);
  const syncDdangyoAbortRef = useRef<AbortController | null>(null);
  const syncYogiyoAbortRef = useRef<AbortController | null>(null);
  const syncCoupangEatsAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isSyncing) syncAbortRef.current = null;
  }, [isSyncing]);
  useEffect(() => {
    if (!isSyncingDdangyo) syncDdangyoAbortRef.current = null;
  }, [isSyncingDdangyo]);
  useEffect(() => {
    if (!isSyncingYogiyo) syncYogiyoAbortRef.current = null;
  }, [isSyncingYogiyo]);
  useEffect(() => {
    if (!isSyncingCoupangEats) syncCoupangEatsAbortRef.current = null;
  }, [isSyncingCoupangEats]);
  useEffect(() => {
    if (isSyncError && (syncError as Error)?.name === "AbortError") resetSync();
  }, [isSyncError, syncError, resetSync]);
  useEffect(() => {
    if (
      isSyncErrorDdangyo &&
      (syncErrorDdangyo as Error)?.name === "AbortError"
    )
      resetSyncDdangyo();
  }, [isSyncErrorDdangyo, syncErrorDdangyo, resetSyncDdangyo]);
  useEffect(() => {
    if (isSyncErrorYogiyo && (syncErrorYogiyo as Error)?.name === "AbortError")
      resetSyncYogiyo();
  }, [isSyncErrorYogiyo, syncErrorYogiyo, resetSyncYogiyo]);
  useEffect(() => {
    if (
      isSyncErrorCoupangEats &&
      (syncErrorCoupangEats as Error)?.name === "AbortError"
    )
      resetSyncCoupangEats();
  }, [isSyncErrorCoupangEats, syncErrorCoupangEats, resetSyncCoupangEats]);

  const addBeforeUnload = useCallback(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  useEffect(() => {
    if (!isSyncing) return;
    return addBeforeUnload();
  }, [isSyncing, addBeforeUnload]);
  useEffect(() => {
    if (!isSyncingDdangyo) return;
    return addBeforeUnload();
  }, [isSyncingDdangyo, addBeforeUnload]);
  useEffect(() => {
    if (!isSyncingYogiyo) return;
    return addBeforeUnload();
  }, [isSyncingYogiyo, addBeforeUnload]);
  useEffect(() => {
    if (!isSyncingCoupangEats) return;
    return addBeforeUnload();
  }, [isSyncingCoupangEats, addBeforeUnload]);

  const handleSyncBaemin = useCallback(() => {
    if (!effectiveStoreId || isSyncing) return;
    const controller = new AbortController();
    syncAbortRef.current = controller;
    syncBaemin({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncBaeminReviewsVariables);
  }, [effectiveStoreId, isSyncing, syncBaemin]);

  const handleSyncDdangyo = useCallback(() => {
    if (!effectiveStoreId || isSyncingDdangyo) return;
    const controller = new AbortController();
    syncDdangyoAbortRef.current = controller;
    syncDdangyo({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncDdangyoReviewsVariables);
  }, [effectiveStoreId, isSyncingDdangyo, syncDdangyo]);

  const handleSyncYogiyo = useCallback(() => {
    if (!effectiveStoreId || isSyncingYogiyo) return;
    const controller = new AbortController();
    syncYogiyoAbortRef.current = controller;
    syncYogiyo({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncYogiyoReviewsVariables);
  }, [effectiveStoreId, isSyncingYogiyo, syncYogiyo]);

  const handleSyncCoupangEats = useCallback(() => {
    if (!effectiveStoreId || isSyncingCoupangEats) return;
    const controller = new AbortController();
    syncCoupangEatsAbortRef.current = controller;
    syncCoupangEats({
      storeId: effectiveStoreId,
      signal: controller.signal,
    } as SyncCoupangEatsReviewsVariables);
  }, [effectiveStoreId, isSyncingCoupangEats, syncCoupangEats]);

  const handleSyncAll = useCallback(() => {
    if (platform !== "") return;
    if (storesBaemin.length > 0) {
      const c = new AbortController();
      syncAbortRef.current = c;
      syncBaemin({
        storeId: storesBaemin[0].id,
        signal: c.signal,
      } as SyncBaeminReviewsVariables);
    }
    if (storesDdangyo.length > 0) {
      const c = new AbortController();
      syncDdangyoAbortRef.current = c;
      syncDdangyo({
        storeId: storesDdangyo[0].id,
        signal: c.signal,
      } as SyncDdangyoReviewsVariables);
    }
    if (storesYogiyo.length > 0) {
      const c = new AbortController();
      syncYogiyoAbortRef.current = c;
      syncYogiyo({
        storeId: storesYogiyo[0].id,
        signal: c.signal,
      } as SyncYogiyoReviewsVariables);
    }
    if (storesCoupangEats.length > 0) {
      const c = new AbortController();
      syncCoupangEatsAbortRef.current = c;
      syncCoupangEats({
        storeId: storesCoupangEats[0].id,
        signal: c.signal,
      } as SyncCoupangEatsReviewsVariables);
    }
  }, [
    platform,
    storesBaemin,
    storesDdangyo,
    storesYogiyo,
    storesCoupangEats,
    syncBaemin,
    syncDdangyo,
    syncYogiyo,
    syncCoupangEats,
  ]);

  return {
    isSyncing,
    isSyncingDdangyo,
    isSyncingYogiyo,
    isSyncingCoupangEats,
    handleSyncBaemin,
    handleSyncDdangyo,
    handleSyncYogiyo,
    handleSyncCoupangEats,
    handleSyncAll,
  };
}
