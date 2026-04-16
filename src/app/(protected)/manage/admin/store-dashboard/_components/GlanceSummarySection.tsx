"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getAdminStoreDashboardGlance } from "@/entities/admin/api/store-api";
import {
  parseAdminDashboardRangeParam,
  type AdminStoreDashboardGlanceData,
} from "@/entities/admin/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";
import { DashboardPlatformBreakdownList } from "@/app/(protected)/manage/_components/DashboardPlatformBreakdownList";
import {
  OrderReviewTrendChart,
  OrderReviewTrendLegend,
} from "@/app/(protected)/manage/_components/OrderReviewTrendChart";
import { useAdminDashboardPlatformStores } from "@/app/(protected)/manage/admin/store-dashboard/_components/AdminDashboardPlatformStoresContext";
import { TagSelect } from "@/components/ui/tag-select";
import { cn } from "@/lib/utils/cn";
import { Info } from "@/components/ui/info";

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

function DeltaLine({ delta, suffix }: { delta: number; suffix: string }) {
  const same = delta === 0;
  const up = delta > 0;
  if (same) {
    return (
      <p className="typo-body-03-regular text-gray-03">지난 기간과 동일</p>
    );
  }
  const abs = Math.abs(delta).toLocaleString("ko-KR");
  const sign = up ? "+" : "−";
  const arrow = up ? "▲" : "▼";
  return (
    <p
      className={cn(
        "typo-body-03-regular",
        up ? "text-red-500" : "text-blue-600",
      )}
    >
      {arrow} 지난 기간보다 {sign}
      {abs}
      {suffix}
    </p>
  );
}

export function GlanceSummarySection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const storeId = searchParams.get("storeId") ?? "";
  const range = parseAdminDashboardRangeParam(searchParams.get("range"));
  const platform = searchParams.get("platform") ?? "";

  const { storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo } =
    useAdminDashboardPlatformStores();

  const [data, setData] = useState<AdminStoreDashboardGlanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** null → 매장 전체(all)면 모든 플랫폼 칩 활성 */
  const linkedPlatformsForStore = useMemo(() => {
    return getDashboardChipLinkedPlatforms(storeId, DASHBOARD_ALL_STORES_ID, {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    });
  }, [storeId, storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo]);

  const setQuery = useCallback(
    (patch: Record<string, string | undefined>) => {
      const q = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") q.delete(k);
        else q.set(k, v);
      }
      router.replace(`${pathname}?${q.toString()}`);
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!platform.trim()) return;
    if (linkedPlatformsForStore == null) return;
    if (linkedPlatformsForStore.has(platform)) return;
    setQuery({ platform: undefined });
  }, [storeId, platform, linkedPlatformsForStore, setQuery]);

  useEffect(() => {
    if (!userId || !storeId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAdminStoreDashboardGlance({
      userId,
      storeId,
      range,
      platform: platform || undefined,
    })
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setError(e.message ?? "불러오기에 실패했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, storeId, range, platform]);

  if (!userId || !storeId) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
          {PLATFORM_FILTERS.map((p) => {
            const chipDisabled =
              !!p.value &&
              linkedPlatformsForStore != null &&
              !linkedPlatformsForStore.has(p.value);
            const checked = (platform || "") === p.value;
            return (
              <TagSelect
                key={p.value || "all"}
                disabled={chipDisabled}
                variant={
                  chipDisabled ? "disabled" : checked ? "checked" : "default"
                }
                onClick={() => {
                  if (chipDisabled) return;
                  setQuery({ platform: p.value || undefined });
                }}
              >
                {p.label}
              </TagSelect>
            );
          })}
        </div>
        {data && (
          <p className="text-[11px] leading-snug text-gray-03 sm:ml-auto sm:text-right">
            {data.asOfLabel}
          </p>
        )}
      </div>

      {loading && (
        <p className="typo-body-02-regular text-gray-03">
          데이터를 불러오는 중…
        </p>
      )}
      {error && <p className="typo-body-02-regular text-red-600">{error}</p>}

      {data && !loading && (
        <>
          <Info
            title="AI 분석"
            description={data.aiSummary}
            icon={
              <span className="text-xl leading-none" aria-hidden>
                🔍
              </span>
            }
          />

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="총 리뷰 수"
              value={`${formatInt(data.current.totalReviews)}개`}
              delta={<DeltaLine delta={data.deltas.reviewCount} suffix="개" />}
            />
            <KpiCard
              title="평균 평점"
              value={
                data.platformBreakdown.length === 1 &&
                data.platformBreakdown[0]?.platform === "ddangyo"
                  ? data.platformBreakdown[0].tastyRatioPercent != null
                    ? `${data.platformBreakdown[0].tastyRatioPercent.toFixed(0)}%`
                    : "—"
                  : data.current.avgRating != null
                    ? `${data.current.avgRating.toFixed(1)}점`
                    : "—"
              }
              delta={
                data.platformBreakdown.length === 1 &&
                data.platformBreakdown[0]?.platform === "ddangyo" ? (
                  data.meta.ddangyoTastyRatioPoints != null ? (
                    <DeltaLine
                      delta={data.meta.ddangyoTastyRatioPoints}
                      suffix="%p"
                    />
                  ) : (
                    <p className="typo-body-03-regular text-gray-03">
                      비교 불가
                    </p>
                  )
                ) : data.deltas.avgRating != null ? (
                  <DeltaLine delta={data.deltas.avgRating} suffix="점" />
                ) : (
                  <p className="typo-body-03-regular text-gray-03">비교 불가</p>
                )
              }
            />
            <KpiCard
              title="주문 수"
              value={`${formatInt(data.current.orderCount)}건`}
              delta={<DeltaLine delta={data.deltas.orderCount} suffix="건" />}
            />
          </div>

          <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
            <section className="rounded-lg border border-[#D9D9D9] bg-white p-4">
              <h2 className="typo-body-02-bold text-gray-04">
                주문 및 리뷰 추이
              </h2>
              <OrderReviewTrendLegend className="mt-4" />
              <div className="mt-4">
                <OrderReviewTrendChart series={data.series} />
              </div>
            </section>

            <section className="rounded-lg border border-[#D9D9D9] bg-white p-4">
              <h2 className="typo-body-02-bold text-gray-04">
                플랫폼별 리뷰 현황
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-gray-03">
                선택한 기간·필터 기준
              </p>
              <DashboardPlatformBreakdownList rows={data.platformBreakdown} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({
  title,
  value,
  delta,
  footnote,
}: {
  title: string;
  value: string;
  delta: React.ReactNode;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <p className="typo-body-03-bold text-gray-02">{title}</p>
      <p className="mt-2 typo-heading-02-bold text-gray-01">{value}</p>
      {footnote}
      <div className="mt-2">{delta}</div>
    </div>
  );
}
