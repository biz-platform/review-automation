"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import {
  getDashboardGlance,
  getDashboardSales,
} from "@/entities/dashboard/api/dashboard-api";
import type {
  DashboardSalesData,
  DashboardSalesRange,
} from "@/entities/dashboard/sales-types";
import type { DashboardGlanceData } from "@/entities/dashboard/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";
import { DashboardSectionCard } from "@/app/(protected)/manage/_components/DashboardSectionCard";
import { TopMenusTable } from "@/app/(protected)/manage/_components/TopMenusTable";

const PLATFORM_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "baemin", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "yogiyo", label: "요기요" },
  { value: "ddangyo", label: "땡겨요" },
];

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function reviewConversionPercent(cv: {
  totalReviews: number;
  orderCount: number;
}): number | null {
  if (cv.orderCount <= 0) return null;
  return Math.round((cv.totalReviews / cv.orderCount) * 1000) / 10;
}

function pctDelta(prev: number, curr: number): number | null {
  if (prev <= 0) return curr > 0 ? null : 0;
  return ((curr - prev) / prev) * 100;
}

function formatPctOne(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function DeltaRow({
  kind,
  delta,
}: {
  kind: "pct" | "pctPoints" | "kinds";
  delta: number | null;
}) {
  if (delta == null || Number.isNaN(delta)) {
    return (
      <p className="typo-body-03-regular text-gray-03">지난 기간과 비교 불가</p>
    );
  }
  const same = kind === "kinds" ? delta === 0 : Math.abs(delta) < 1e-6;
  if (same) {
    return (
      <p className="typo-body-03-regular text-gray-03">지난 기간과 동일</p>
    );
  }
  const up = delta > 0;
  const abs = Math.abs(delta);
  const sign = up ? "+" : "−";
  const arrow = up ? "▲" : "▼";
  const suffix = kind === "pct" ? "%" : kind === "pctPoints" ? "%p" : "종";
  const valueText =
    kind === "kinds" ? String(Math.round(abs)) : formatPctOne(abs);
  return (
    <p
      className={cn(
        "typo-body-03-regular",
        up ? "text-red-500" : "text-blue-600",
      )}
    >
      {arrow} 지난 기간보다 {sign}
      {valueText}
      {suffix}
    </p>
  );
}

export function MenuSummarySection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const storeId = searchParams.get("storeId") ?? "";
  const range = (searchParams.get("range") ?? "30d") as DashboardSalesRange;
  const platform = searchParams.get("platform") ?? "";

  const { storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo } =
    useReviewsManageStores("");

  const linkedPlatformsForStore = useMemo(() => {
    return getDashboardChipLinkedPlatforms(storeId, DASHBOARD_ALL_STORES_ID, {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    });
  }, [storeId, storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo]);

  const [data, setData] = useState<DashboardSalesData | null>(null);
  const [glance, setGlance] = useState<DashboardGlanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setQuery = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pathname}?${q.toString()}`);
  };

  const rangeParam = range === "30d" ? "30d" : "7d";

  useEffect(() => {
    if (!platform.trim()) return;
    if (linkedPlatformsForStore == null) return;
    if (linkedPlatformsForStore.has(platform)) return;
    setQuery({ platform: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, platform, linkedPlatformsForStore]);

  useEffect(() => {
    if (!storeId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const salesReq = getDashboardSales({
      storeId,
      range: rangeParam,
      platform: platform || undefined,
    });
    const glanceReq = getDashboardGlance({
      storeId,
      range: rangeParam,
      platform: platform || undefined,
    });
    void Promise.all([salesReq, glanceReq])
      .then(([sales, g]) => {
        if (!cancelled) {
          setData(sales);
          setGlance(g);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setGlance(null);
          setError(e.message ?? "불러오기에 실패했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, rangeParam, platform]);

  const menuKpis = useMemo(() => {
    if (!data || !glance) return null;
    const m = data.menuPeriodMetrics;
    const soldPctDelta = pctDelta(m.previousSoldQuantity, m.soldQuantity);
    const kindsDelta = m.distinctMenuCount - m.previousDistinctMenuCount;
    const curR = reviewConversionPercent(glance.current);
    const prevR = reviewConversionPercent(glance.previous);
    const convDeltaPP = curR != null && prevR != null ? curR - prevR : null;
    return {
      soldQty: m.soldQuantity,
      soldPctDelta,
      distinctKinds: m.distinctMenuCount,
      kindsDelta,
      reviewConv: curR,
      convDeltaPP,
    };
  }, [data, glance]);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
          {PLATFORM_FILTERS.filter((p) => {
            if (p.value === "") return true;
            if (linkedPlatformsForStore == null) return true;
            return linkedPlatformsForStore.has(p.value);
          }).map((p) => (
            <TagSelect
              key={p.value || "all"}
              variant={platform === p.value ? "checked" : "default"}
              onClick={() => setQuery({ platform: p.value || undefined })}
            >
              {p.label}
            </TagSelect>
          ))}
        </div>
        <p className="min-h-9 text-[11px] leading-snug text-gray-03 flex items-center sm:text-right">
          {loading ? "기준 시각 불러오는 중…" : (data?.asOfLabel ?? "")}
        </p>
      </div>

      <div className="mt-4">
        <Info
          title="AI 분석"
          description={
            data?.aiInsights?.menu?.text ??
            "메뉴 매출 데이터를 분석 중이에요."
          }
        />
      </div>

      {loading ? (
        <p className="mt-6 typo-body-02-regular text-gray-03">불러오는 중…</p>
      ) : error ? (
        <p className="mt-6 typo-body-02-regular text-red-500">{error}</p>
      ) : !data || !glance ? (
        <p className="mt-6 typo-body-02-regular text-gray-03">
          데이터가 없습니다.
        </p>
      ) : (
        <>
          <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
            <MenuKpiCard
              title="판매 메뉴 수"
              value={`${formatInt(menuKpis?.soldQty ?? 0)}건`}
              delta={
                <DeltaRow kind="pct" delta={menuKpis?.soldPctDelta ?? null} />
              }
            />
            <MenuKpiCard
              title="리뷰 전환율"
              value={
                menuKpis?.reviewConv != null
                  ? `${formatPctOne(menuKpis.reviewConv)}%`
                  : "—"
              }
              delta={
                <DeltaRow
                  kind="pctPoints"
                  delta={menuKpis?.convDeltaPP ?? null}
                />
              }
            />
            <MenuKpiCard
              title="판매된 메뉴"
              value={`${formatInt(menuKpis?.distinctKinds ?? 0)}가지`}
              delta={
                <DeltaRow kind="kinds" delta={menuKpis?.kindsDelta ?? null} />
              }
            />
          </div>

          <div className="mt-6">
            <TopMenusTable
              rows={data.topMenus}
              soldQuantityTotal={data.menuPeriodMetrics.soldQuantity}
            />
          </div>
        </>
      )}
    </div>
  );
}

function MenuKpiCard({
  title,
  value,
  delta,
}: {
  title: string;
  value: string;
  delta: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#D9D9D9] bg-white p-4">
      <p className="typo-body-03-regular text-gray-03">{title}</p>
      <p className="mt-2 typo-heading-02-bold text-gray-01 tabular-nums">
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}
