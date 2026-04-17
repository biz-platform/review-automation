"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { buildDashboardStoreOptionsFromPlatformShops } from "@/lib/dashboard/build-dashboard-store-options-from-platform-shops";
import {
  formatDashboardStoreLabels,
  mergeDashboardStoreAllOptionWithSinglePlainUuidRow,
} from "@/lib/dashboard/dashboard-store-options-group";
import { ManageDashboardShellFrame } from "@/app/(protected)/manage/_components/ManageDashboardShellFrame";
import { DashboardShellNav } from "@/app/(protected)/manage/dashboard/_components/DashboardShellNav";
import type { DashboardShellTabDef } from "@/app/(protected)/manage/dashboard/_components/DashboardShellNav";
import { DashboardStoreSelect } from "@/app/(protected)/manage/dashboard/_components/DashboardStoreSelect";

const TABS: readonly DashboardShellTabDef[] = [
  { href: "/manage/dashboard/summary", label: "한 눈에 요약", end: true },
  { href: "/manage/dashboard/sales", label: "매출 분석", end: false },
  { href: "/manage/dashboard/reviews", label: "리뷰 분석", end: false },
  { href: "/manage/dashboard/menus", label: "메뉴 분석", end: false },
] as const;

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const storeIdParam = searchParams.get("storeId") ?? "";
  const {
    allStores: stores,
    storesLoading,
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
  } = useReviewsManageStores("");
  const storesReady = !storesLoading;

  const builtStoreOptions = useMemo(
    () =>
      buildDashboardStoreOptionsFromPlatformShops({
        storesBaemin,
        storesCoupangEats,
        storesDdangyo,
        storesYogiyo,
      }),
    [storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo],
  );

  const storeIdForQuery = useMemo(() => {
    if (storeIdParam) return storeIdParam;
    if (stores.length > 0) return DASHBOARD_ALL_STORES_ID;
    return "";
  }, [storeIdParam, stores.length]);

  const buildTabHref = useCallback(
    (tabPath: string) => {
      const q = new URLSearchParams(searchParams.toString());
      if (storeIdForQuery) q.set("storeId", storeIdForQuery);
      if (!q.get("range")) q.set("range", "30d");
      const qs = q.toString();
      return qs ? `${tabPath}?${qs}` : tabPath;
    },
    [searchParams, storeIdForQuery],
  );

  useEffect(() => {
    if (!storesReady || stores.length === 0) return;
    if (searchParams.get("storeId")) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("storeId", DASHBOARD_ALL_STORES_ID);
    if (!q.get("range")) q.set("range", "30d");
    router.replace(`${pathname}?${q.toString()}`);
  }, [storesReady, stores.length, pathname, router, searchParams]);

  useEffect(() => {
    if (!storeIdForQuery) return;
    if (searchParams.get("range")) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("range", "30d");
    router.replace(`${pathname}?${q.toString()}`);
  }, [storeIdForQuery, pathname, router, searchParams]);

  /** 매장 전체 + 순수 UUID 한 줄만 있으면 동일 스코프 → URL을 `all`로 통일 */
  useEffect(() => {
    if (!storesReady || builtStoreOptions.length !== 2) return;
    if (storeIdParam === DASHBOARD_ALL_STORES_ID) return;
    const labeled = formatDashboardStoreLabels(builtStoreOptions);
    const merged = mergeDashboardStoreAllOptionWithSinglePlainUuidRow(labeled);
    if (merged.length !== 1 || storeIdParam !== labeled[1]?.value) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("storeId", DASHBOARD_ALL_STORES_ID);
    if (!q.get("range")) q.set("range", "30d");
    router.replace(`${pathname}?${q.toString()}`);
  }, [
    storesReady,
    builtStoreOptions,
    storeIdParam,
    pathname,
    router,
    searchParams,
  ]);

  const options = useMemo(() => {
    if (!storesReady || builtStoreOptions.length <= 1) return [];
    const labeled = formatDashboardStoreLabels(builtStoreOptions);
    const merged =
      mergeDashboardStoreAllOptionWithSinglePlainUuidRow(labeled);
    return merged.map((o) => ({
      id: o.value === "" ? DASHBOARD_ALL_STORES_ID : o.value,
      label: o.label,
    }));
  }, [builtStoreOptions, storesReady]);

  const selectValue =
    storeIdParam === DASHBOARD_ALL_STORES_ID ||
    (storeIdParam && options.some((o) => o.id === storeIdParam))
      ? storeIdParam
      : options.length > 0
        ? DASHBOARD_ALL_STORES_ID
        : "";

  const emptyStoreMessage =
    stores.length === 0 && !storesLoading
      ? "연동된 매장이 없습니다. 매장 관리에서 연동을 먼저 진행해 주세요."
      : null;

  const onStoreChange = useCallback(
    (nextStoreId: string) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("storeId", nextStoreId);
      if (!q.get("range")) q.set("range", "30d");
      router.replace(`${pathname}?${q.toString()}`);
    },
    [pathname, router, searchParams],
  );

  return (
    <ManageDashboardShellFrame
      filterRow={
        <DashboardStoreSelect
          loading={storesLoading}
          options={options}
          value={selectValue}
          onChange={onStoreChange}
        />
      }
      tabNav={
        <DashboardShellNav
          tabs={TABS}
          pathname={pathname}
          getTabHref={(tabHref) =>
            storeIdForQuery ? buildTabHref(tabHref) : tabHref
          }
        />
      }
      rangeControl={null}
    >
      {emptyStoreMessage ? (
        <div className="rounded-xl border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
          {emptyStoreMessage}
        </div>
      ) : (
        children
      )}
    </ManageDashboardShellFrame>
  );
}
