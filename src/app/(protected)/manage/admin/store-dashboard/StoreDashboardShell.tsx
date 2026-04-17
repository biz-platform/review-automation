"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminStores, getAdminUserPlatformStores } from "@/entities/admin/api/store-api";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import {
  ADMIN_DASHBOARD_DEFAULT_RANGE,
  parseAdminDashboardRangeParam,
  type AdminStoreSummaryRow,
} from "@/entities/admin/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { buildDashboardStoreOptionsFromPlatformShops } from "@/lib/dashboard/build-dashboard-store-options-from-platform-shops";
import {
  formatDashboardStoreLabels,
  mergeDashboardStoreAllOptionWithSinglePlainUuidRow,
} from "@/lib/dashboard/dashboard-store-options-group";
import { ManageDashboardShellFrame } from "@/app/(protected)/manage/_components/ManageDashboardShellFrame";
import { adminDashboardUserLabel } from "@/app/(protected)/manage/admin/store-dashboard/_components/admin-dashboard-user-label";
import {
  AdminDashboardPlatformStoresProvider,
  type AdminDashboardPlatformStoresValue,
} from "@/app/(protected)/manage/admin/store-dashboard/_components/AdminDashboardPlatformStoresContext";
import { StoreDashboardShellNav } from "@/app/(protected)/manage/admin/store-dashboard/_components/StoreDashboardShellNav";
import type { StoreDashboardShellTabDef } from "@/app/(protected)/manage/admin/store-dashboard/_components/StoreDashboardShellNav";
import { StoreDashboardStoreSelect } from "@/app/(protected)/manage/admin/store-dashboard/_components/StoreDashboardStoreSelect";
import {
  StoreDashboardUserSelect,
  type StoreDashboardUserOption,
} from "@/app/(protected)/manage/admin/store-dashboard/_components/StoreDashboardUserSelect";

const TABS: readonly StoreDashboardShellTabDef[] = [
  { href: "/manage/admin/store-dashboard/summary", label: "한 눈에 요약", end: true },
  { href: "/manage/admin/store-dashboard/sales", label: "매출 분석", end: false },
  { href: "/manage/admin/store-dashboard/reviews", label: "리뷰 분석", end: false },
  { href: "/manage/admin/store-dashboard/menus", label: "메뉴 분석", end: false },
] as const;

const emptyPlatformStores: Pick<
  AdminDashboardPlatformStoresValue,
  "storesBaemin" | "storesCoupangEats" | "storesDdangyo" | "storesYogiyo"
> = {
  storesBaemin: [],
  storesCoupangEats: [],
  storesDdangyo: [],
  storesYogiyo: [],
};

export function StoreDashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: profile, isLoading: profileLoading } = useAccountProfile();

  const userId = searchParams.get("userId") ?? "";
  const storeId = searchParams.get("storeId") ?? "";

  const [listLoading, setListLoading] = useState(true);
  const [userRows, setUserRows] = useState<AdminStoreSummaryRow[]>([]);
  const [platformStoresLoading, setPlatformStoresLoading] = useState(false);
  const [platformStores, setPlatformStores] =
    useState<AdminDashboardPlatformStoresValue>({
      loading: true,
      ...emptyPlatformStores,
    });

  const userSelectOptions = useMemo((): StoreDashboardUserOption[] => {
    const base = userRows.map((row) => ({
      userId: row.userId,
      label: adminDashboardUserLabel(row),
    }));
    if (userId && !base.some((o) => o.userId === userId)) {
      return [
        {
          userId,
          label: `${userId.slice(0, 8)}… (목록에 없음)`,
        },
        ...base,
      ];
    }
    return base;
  }, [userRows, userId]);

  const builtStoreOptions = useMemo(
    () =>
      buildDashboardStoreOptionsFromPlatformShops({
        storesBaemin: platformStores.storesBaemin,
        storesCoupangEats: platformStores.storesCoupangEats,
        storesDdangyo: platformStores.storesDdangyo,
        storesYogiyo: platformStores.storesYogiyo,
      }),
    [
      platformStores.storesBaemin,
      platformStores.storesCoupangEats,
      platformStores.storesDdangyo,
      platformStores.storesYogiyo,
    ],
  );

  const storesReady = userId.trim() !== "" && !platformStoresLoading;

  const storeSelectOptions = useMemo(() => {
    if (!storesReady || builtStoreOptions.length <= 1) return [];
    const labeled = formatDashboardStoreLabels(builtStoreOptions);
    const merged =
      mergeDashboardStoreAllOptionWithSinglePlainUuidRow(labeled);
    return merged.map((o) => ({
      storeId: o.value === "" ? DASHBOARD_ALL_STORES_ID : o.value,
      label: o.label,
    }));
  }, [builtStoreOptions, storesReady]);

  useEffect(() => {
    if (!userId.trim() || !storesReady || builtStoreOptions.length !== 2) return;
    if (storeId === DASHBOARD_ALL_STORES_ID) return;
    const labeled = formatDashboardStoreLabels(builtStoreOptions);
    const merged = mergeDashboardStoreAllOptionWithSinglePlainUuidRow(labeled);
    if (merged.length !== 1 || storeId !== labeled[1]?.value) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("userId", userId);
    q.set("storeId", DASHBOARD_ALL_STORES_ID);
    if (!q.get("range")?.trim()) q.set("range", ADMIN_DASHBOARD_DEFAULT_RANGE);
    router.replace(`${pathname}?${q.toString()}`);
  }, [
    userId,
    storesReady,
    builtStoreOptions,
    storeId,
    pathname,
    router,
    searchParams,
  ]);

  const storeSelectValue =
    storeId === DASHBOARD_ALL_STORES_ID ||
    (storeId && storeSelectOptions.some((o) => o.storeId === storeId))
      ? storeId
      : storeSelectOptions.length > 0
        ? DASHBOARD_ALL_STORES_ID
        : "";

  const hasLinkedStores =
    platformStores.storesBaemin.length +
      platformStores.storesCoupangEats.length +
      platformStores.storesDdangyo.length +
      platformStores.storesYogiyo.length >
    0;

  const syncQuery = useCallback(
    (next: { userId: string; storeId: string }) => {
      const q = new URLSearchParams(searchParams.toString());
      if (next.userId) q.set("userId", next.userId);
      else q.delete("userId");
      if (next.storeId) q.set("storeId", next.storeId);
      else q.delete("storeId");
      if (!q.get("range")?.trim()) q.set("range", ADMIN_DASHBOARD_DEFAULT_RANGE);
      router.replace(`${pathname}?${q.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const buildTabHref = useCallback(
    (tabPath: string) => {
      const q = new URLSearchParams(searchParams.toString());
      if (userId) q.set("userId", userId);
      if (storeId) q.set("storeId", storeId);
      if (!q.get("range")?.trim()) q.set("range", ADMIN_DASHBOARD_DEFAULT_RANGE);
      const qs = q.toString();
      return qs ? `${tabPath}?${qs}` : tabPath;
    },
    [searchParams, userId, storeId],
  );

  useEffect(() => {
    if (!profile?.is_admin) {
      setListLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setListLoading(true);
      try {
        const data = await getAdminStores({ limit: 100, offset: 0 });
        if (cancelled) return;
        setUserRows(data.list);
        if (!searchParams.get("userId") && data.list[0]) {
          const q = new URLSearchParams(searchParams.toString());
          q.set("userId", data.list[0].userId);
          if (!q.get("range")?.trim()) q.set("range", ADMIN_DASHBOARD_DEFAULT_RANGE);
          router.replace(`${pathname}?${q.toString()}`);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 고객 목록 1회 로드·기본 userId 주입
  }, [profile?.is_admin]);

  useEffect(() => {
    if (!userId || !profile?.is_admin) {
      setPlatformStores({
        loading: false,
        ...emptyPlatformStores,
      });
      return;
    }
    let cancelled = false;
    setPlatformStoresLoading(true);
    setPlatformStores((prev) => ({ ...prev, loading: true }));
    void getAdminUserPlatformStores({ userId })
      .then((d) => {
        if (cancelled) return;
        setPlatformStores({
          loading: false,
          storesBaemin: d.storesBaemin,
          storesCoupangEats: d.storesCoupangEats,
          storesDdangyo: d.storesDdangyo,
          storesYogiyo: d.storesYogiyo,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPlatformStores({ loading: false, ...emptyPlatformStores });
        }
      })
      .finally(() => {
        if (!cancelled) setPlatformStoresLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, profile?.is_admin]);

  useEffect(() => {
    if (!userId.trim() || platformStoresLoading) return;
    if (!hasLinkedStores) {
      if (searchParams.get("storeId")) {
        const q = new URLSearchParams(searchParams.toString());
        q.delete("storeId");
        router.replace(`${pathname}?${q.toString()}`);
      }
      return;
    }
    if (storeSelectOptions.length === 0) return;
    const valid =
      storeId === DASHBOARD_ALL_STORES_ID ||
      storeSelectOptions.some((o) => o.storeId === storeId);
    if (valid) return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("userId", userId);
    q.set("storeId", DASHBOARD_ALL_STORES_ID);
    if (!q.get("range")?.trim()) q.set("range", ADMIN_DASHBOARD_DEFAULT_RANGE);
    router.replace(`${pathname}?${q.toString()}`);
  }, [
    userId,
    storeId,
    hasLinkedStores,
    platformStoresLoading,
    storeSelectOptions,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!userId || !storeId) return;
    const raw = searchParams.get("range");
    if (raw === "7d" || raw === "30d") return;
    const q = new URLSearchParams(searchParams.toString());
    q.set("range", parseAdminDashboardRangeParam(raw));
    router.replace(`${pathname}?${q.toString()}`);
  }, [userId, storeId, pathname, router, searchParams]);

  if (profileLoading) {
    return (
      <div className="typo-body-02-regular text-gray-03">불러오는 중…</div>
    );
  }

  if (!profile?.is_admin) {
    return (
      <div className="typo-body-02-regular text-red-600">
        관리자만 접근할 수 있습니다.
      </div>
    );
  }

  const emptyStoreMessage =
    userId && !platformStoresLoading && !hasLinkedStores
      ? "이 고객에게 연동된 매장이 없습니다."
      : null;

  const showShellBody =
    Boolean(userId) && Boolean(storeId) && (hasLinkedStores || platformStoresLoading);

  return (
    <AdminDashboardPlatformStoresProvider value={platformStores}>
      <ManageDashboardShellFrame
        filterRow={
          <>
            <StoreDashboardUserSelect
              loading={listLoading}
              options={userSelectOptions}
              value={userId}
              onChange={(nextUserId) =>
                syncQuery({ userId: nextUserId, storeId: "" })
              }
            />
            <StoreDashboardStoreSelect
              listLoading={listLoading || platformStoresLoading}
              options={storeSelectOptions}
              value={storeSelectValue}
              userId={userId}
              onChange={(nextStoreId) =>
                syncQuery({ userId, storeId: nextStoreId })
              }
            />
          </>
        }
        tabNav={
          <StoreDashboardShellNav
            tabs={TABS}
            pathname={pathname}
            getTabHref={(tabHref) =>
              userId && storeId ? buildTabHref(tabHref) : tabHref
            }
          />
        }
        rangeControl={null}
      >
        {!userId ? (
          <div className="rounded-xl border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
            {listLoading
              ? "고객·매장 목록을 불러오는 중입니다."
              : "표시할 고객이 없습니다."}
          </div>
        ) : emptyStoreMessage ? (
          <div className="rounded-xl border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
            {emptyStoreMessage}
          </div>
        ) : !storeId ? (
          <div className="rounded-xl border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
            {platformStoresLoading
              ? "매장 목록을 불러오는 중입니다."
              : "매장을 선택해 주세요."}
          </div>
        ) : showShellBody ? (
          children
        ) : null}
      </ManageDashboardShellFrame>
    </AdminDashboardPlatformStoresProvider>
  );
}
