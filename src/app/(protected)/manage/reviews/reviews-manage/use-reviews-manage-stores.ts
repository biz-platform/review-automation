"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import type { StoreWithSessionData } from "@/entities/store/types";
import { PLATFORMS_LINKED } from "../constants";

export function useReviewsManageStores(platform: string) {
  const { data: storeListData, isLoading: storesLoading } = useStoreList(
    platform && PLATFORMS_LINKED.includes(platform as (typeof PLATFORMS_LINKED)[number])
      ? platform
      : undefined,
  );
  const { data: allStoresData } = useStoreList();
  const { data: storesBaemin = [] } = useStoreList("baemin");
  const { data: storesCoupangEats = [] } = useStoreList("coupang_eats");
  const { data: storesDdangyo = [] } = useStoreList("ddangyo");
  const { data: storesYogiyo = [] } = useStoreList("yogiyo");

  const allStores = allStoresData ?? [];
  const linkedStores = platform ? (storeListData ?? []) : [];

  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  useEffect(() => {
    if (
      linkedStores.length > 0 &&
      !linkedStores.some((s) => s.id === selectedStoreId)
    ) {
      setSelectedStoreId(linkedStores[0].id);
    }
  }, [linkedStores, selectedStoreId]);

  const effectiveStoreId =
    selectedStoreId && linkedStores.some((s) => s.id === selectedStoreId)
      ? selectedStoreId
      : (linkedStores[0]?.id ?? null);

  const isBaemin = platform === "baemin";
  const showLinkPrompt =
    isBaemin && !storesLoading && linkedStores.length === 0;

  const linkedPlatforms = useMemo(
    () =>
      (
        [
          ["baemin", storesBaemin.length],
          ["coupang_eats", storesCoupangEats.length],
          ["ddangyo", storesDdangyo.length],
          ["yogiyo", storesYogiyo.length],
        ] as const
      )
        .filter(([, n]) => n > 0)
        .map(([p]) => p),
    [
      storesBaemin.length,
      storesCoupangEats.length,
      storesDdangyo.length,
      storesYogiyo.length,
    ],
  );

  const accountsLink =
    allStores.length > 0
      ? `/manage/stores/${allStores[0].id}/accounts?platform=${platform || "baemin"}`
      : `/manage/stores?accounts=1&platform=${platform || "baemin"}`;

  const sessionName = (s: StoreWithSessionData) =>
    (s as StoreWithSessionData).store_name ?? s.name;

  const storeIdToName = useMemo(() => {
    const map = new Map<string, string>();
    if (platform && linkedStores.length > 0) {
      for (const s of linkedStores) {
        map.set(s.id, sessionName(s));
      }
    } else {
      for (const s of allStores) {
        map.set(s.id, s.name);
      }
      const platformLists = [
        ["baemin", storesBaemin],
        ["coupang_eats", storesCoupangEats],
        ["ddangyo", storesDdangyo],
        ["yogiyo", storesYogiyo],
      ] as const;
      for (const [plat, stores] of platformLists) {
        for (const s of stores) {
          map.set(`${s.id}:${plat}`, sessionName(s));
        }
      }
    }
    return map;
  }, [
    platform,
    linkedStores,
    allStores,
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
  ]);

  const getStoreDisplayName = useCallback(
    (storeId: string, reviewPlatform?: string | null): string => {
      if (reviewPlatform) {
        return (
          storeIdToName.get(`${storeId}:${reviewPlatform}`) ??
          storeIdToName.get(storeId) ??
          ""
        );
      }
      return storeIdToName.get(storeId) ?? "";
    },
    [storeIdToName],
  );

  return {
    allStores,
    linkedStores,
    linkedPlatforms,
    accountsLink,
    selectedStoreId,
    setSelectedStoreId,
    effectiveStoreId,
    showLinkPrompt,
    isBaemin,
    storesLoading,
    storeIdToName,
    getStoreDisplayName,
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
  };
}
