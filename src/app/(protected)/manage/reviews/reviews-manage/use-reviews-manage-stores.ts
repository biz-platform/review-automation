"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import type { StoreWithSessionData } from "@/entities/store/types";
import { PLATFORMS_LINKED } from "../constants";
import { disambiguateBaeminShopLabels } from "./store-filter-utils";

function parsePlatformStoreSelection(
  value: string,
  platform: string,
): {
  storeId: string | null;
  shopExternalId: string | null;
} {
  const v = value.trim();
  if (!v) return { storeId: null, shopExternalId: null };
  const parts = v.split(":");
  if (parts.length === 2 && parts[1] === platform) {
    return {
      storeId: parts[0]?.trim() || null,
      shopExternalId: null,
    };
  }
  if (parts.length >= 3 && parts[1] === platform) {
    return {
      storeId: parts[0]?.trim() || null,
      shopExternalId: parts.slice(2).join(":").trim() || null,
    };
  }
  return { storeId: v, shopExternalId: null };
}

function getPrimaryPlatformShopName(store: StoreWithSessionData): string | null {
  const shops = store.platform_shops ?? [];
  if (shops.length === 0) return null;
  const primary = shops.find((shop) => shop.is_primary) ?? shops[0];
  const name = primary?.shop_name?.trim();
  return name ? name : null;
}

const PLATFORM_SUFFIX_LABEL: Record<string, string> = {
  baemin: "배민",
  coupang_eats: "쿠팡이츠",
  ddangyo: "땡겨요",
  yogiyo: "요기요",
};

function withPlatformSuffix(label: string, platform: string): string {
  const trimmed = label.trim();
  const suffix = PLATFORM_SUFFIX_LABEL[platform] ?? platform;
  return `${trimmed}(${suffix})`;
}

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

  const selectedPlatformSelection = parsePlatformStoreSelection(
    selectedStoreId,
    platform,
  );
  const selectedStoreIdBase = selectedPlatformSelection.storeId;
  const effectiveStoreId =
    selectedStoreIdBase && linkedStores.some((s) => s.id === selectedStoreIdBase)
      ? selectedStoreIdBase
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

  /** 드롭다운용 옵션: 전체 플랫폼이면 모든 연동 매장(플랫폼별), 아니면 해당 플랫폼 연동 매장 */
  const storeFilterOptions = useMemo(() => {
    const all = { value: "", label: "매장 전체" };
    if (platform) {
      if (platform === "baemin") {
        const options: { value: string; label: string }[] = [all];
        for (const s of linkedStores) {
          const shops = (s as StoreWithSessionData).platform_shops ?? [];
          if (shops.length === 0) {
            options.push({
              value: s.id,
              label:
                getStoreDisplayName(s.id, platform) || sessionName(s) || s.name || s.id,
            });
            continue;
          }
          const fb =
            getStoreDisplayName(s.id, platform) ||
            sessionName(s) ||
            s.name ||
            "";
          const raw = shops.map((shop) => ({
            platform_shop_external_id: shop.platform_shop_external_id,
            label:
              shop.shop_name?.trim() ||
              fb ||
              shop.platform_shop_external_id,
          }));
          for (const it of disambiguateBaeminShopLabels(raw)) {
            options.push({
              value: `${s.id}:baemin:${it.platform_shop_external_id}`,
              label: it.label,
            });
          }
        }
        return options;
      }
      if (
        platform === "coupang_eats" ||
        platform === "yogiyo" ||
        platform === "ddangyo"
      ) {
        const options: { value: string; label: string }[] = [all];
        for (const s of linkedStores) {
          const store = s as StoreWithSessionData;
          const shops = store.platform_shops ?? [];
          const fb =
            getStoreDisplayName(s.id, platform) || sessionName(s) || s.name || s.id;
          if (shops.length === 0) {
            options.push({
              value: s.id,
              label: fb,
            });
            continue;
          }
          for (const shop of shops) {
            const platformShopExternalId = shop.platform_shop_external_id?.trim();
            if (!platformShopExternalId) continue;
            options.push({
              value: `${s.id}:${platform}:${platformShopExternalId}`,
              label: shop.shop_name?.trim() || fb || platformShopExternalId,
            });
          }
        }
        return options;
      }
      return [
        all,
        ...linkedStores.map((s) => ({
          value: s.id,
          label:
            (platform === "coupang_eats"
              ? getPrimaryPlatformShopName(s as StoreWithSessionData)
              : null) ||
            getStoreDisplayName(s.id, platform) ||
            sessionName(s) ||
            s.name ||
            s.id,
        })),
      ];
    }
    const platformLists = [
      ["baemin", storesBaemin],
      ["coupang_eats", storesCoupangEats],
      ["ddangyo", storesDdangyo],
      ["yogiyo", storesYogiyo],
    ] as const;
    const options: { value: string; label: string }[] = [all];
    for (const [plat, stores] of platformLists) {
      for (const s of stores) {
        const store = s as StoreWithSessionData;
        const shops = store.platform_shops ?? [];
        const fb =
          getStoreDisplayName(s.id, plat) || sessionName(s) || s.name || s.id;

        if (
          (plat === "baemin" ||
            plat === "coupang_eats" ||
            plat === "yogiyo" ||
            plat === "ddangyo") &&
          shops.length > 0
        ) {
          const raw = shops.map((shop) => ({
            platform_shop_external_id: shop.platform_shop_external_id,
            label: shop.shop_name?.trim() || fb || shop.platform_shop_external_id,
          }));
          const disambiguated =
            plat === "baemin"
              ? disambiguateBaeminShopLabels(raw)
              : plat === "yogiyo" || plat === "ddangyo"
                ? disambiguateBaeminShopLabels(raw)
                : raw;
          for (const it of disambiguated) {
            options.push({
              value: `${s.id}:${plat}:${it.platform_shop_external_id}`,
              label: withPlatformSuffix(it.label, plat),
            });
          }
          continue;
        }

        options.push({
          value: `${s.id}:${plat}`,
          label: withPlatformSuffix(fb, plat),
        });
      }
    }
    return options;
  }, [
    platform,
    linkedStores,
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
    getStoreDisplayName,
  ]);

  useEffect(() => {
    if (platform && linkedStores.length > 0) {
      if (selectedStoreId.trim() === "") {
        return;
      }
      const selectedBase =
        parsePlatformStoreSelection(selectedStoreId, platform).storeId;
      const valid =
        selectedBase &&
        linkedStores.some((s) => s.id === selectedBase);
      if (!valid) {
        if (platform === "baemin") {
          const firstStore = linkedStores[0];
          const firstShop = (firstStore as StoreWithSessionData | undefined)
            ?.platform_shops?.[0];
          if (firstStore && firstShop?.platform_shop_external_id) {
            setSelectedStoreId(
              `${firstStore.id}:baemin:${firstShop.platform_shop_external_id}`,
            );
          } else {
            setSelectedStoreId(linkedStores[0].id);
          }
        } else if (
          platform === "coupang_eats" ||
          platform === "yogiyo" ||
          platform === "ddangyo"
        ) {
          const firstStore = linkedStores[0];
          const firstShop = (firstStore as StoreWithSessionData | undefined)
            ?.platform_shops?.[0];
          if (firstStore && firstShop?.platform_shop_external_id) {
            setSelectedStoreId(
              `${firstStore.id}:${platform}:${firstShop.platform_shop_external_id}`,
            );
          } else {
            setSelectedStoreId(linkedStores[0].id);
          }
        } else {
          setSelectedStoreId(linkedStores[0].id);
        }
      }
    }
  }, [platform, linkedStores, selectedStoreId]);

  return {
    allStores,
    linkedStores,
    storeFilterOptions,
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
