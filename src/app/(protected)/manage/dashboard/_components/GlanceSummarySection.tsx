"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { getDashboardGlance } from "@/entities/dashboard/api/dashboard-api";
import type {
  DashboardGlanceData,
  DashboardRange,
} from "@/entities/dashboard/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";
import { DashboardPlatformBreakdownList } from "@/app/(protected)/manage/_components/DashboardPlatformBreakdownList";
import {
  OrderReviewTrendChart,
  OrderReviewTrendLegend,
} from "@/app/(protected)/manage/_components/OrderReviewTrendChart";
import {
  GlancePercentDeltaLine,
  GlancePointsDeltaLine,
} from "@/app/(protected)/manage/_components/GlanceKpiDeltaLine";
import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import dateIcon from "@/assets/icons/24px/date.webp";
import Image from "next/image";
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
} from "@/components/ui/dropdown";

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

export function GlanceSummarySection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const storeId = searchParams.get("storeId") ?? "";
  const range = ((searchParams.get("range") === "7d" ||
  searchParams.get("range") === "30d"
    ? searchParams.get("range")
    : "30d") ?? "30d") as DashboardRange;
  const platform = searchParams.get("platform") ?? "";

  const { storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo } =
    useReviewsManageStores("");

  /** null → 매장 전체(all)이면 모든 플랫폼 칩 활성 */
  const linkedPlatformsForStore = useMemo(() => {
    return getDashboardChipLinkedPlatforms(storeId, DASHBOARD_ALL_STORES_ID, {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    });
  }, [storeId, storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo]);

  const [data, setData] = useState<DashboardGlanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);

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
    if (!storeId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getDashboardGlance({
      storeId,
      range: range === "30d" ? "30d" : "7d",
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
  }, [storeId, range, platform]);

  if (!storeId.trim()) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* mobile: dropdown + calendar, desktop: chips */}
        <div className="flex items-center gap-2 sm:hidden">
          <MaskedNativeSelect
            uiSize="sm"
            value={platform}
            onChange={(e) =>
              setQuery({ platform: e.target.value || undefined })
            }
            wrapperClassName="min-w-0 flex-1"
            className="bg-white"
          >
            {PLATFORM_FILTERS.map((p) => {
              const disabled =
                !!p.value &&
                linkedPlatformsForStore != null &&
                !linkedPlatformsForStore.has(p.value);
              return (
                <option
                  key={p.value || "all"}
                  value={p.value}
                  disabled={disabled}
                >
                  {p.value ? `${p.label}` : "플랫폼 전체"}
                </option>
              );
            })}
          </MaskedNativeSelect>

          <DropdownRoot open={rangeOpen} onOpenChange={setRangeOpen}>
            <button
              type="button"
              aria-label="기간 선택"
              aria-expanded={rangeOpen}
              onClick={() => setRangeOpen(!rangeOpen)}
              className="flex h-[38px] w-[48px] items-center justify-center rounded-lg border border-gray-07 bg-white"
            >
              <Image src={dateIcon} alt="" width={24} height={24} />
            </button>
            <DropdownContent className="right-0 left-auto min-w-[200px]">
              <DropdownItem
                onSelect={() => setQuery({ range: "30d" })}
                className={range === "30d" ? "bg-gray-08" : undefined}
              >
                한 달
              </DropdownItem>
              <DropdownItem
                onSelect={() => setQuery({ range: "7d" })}
                className={range === "7d" ? "bg-gray-08" : undefined}
              >
                최근 7일
              </DropdownItem>
            </DropdownContent>
          </DropdownRoot>
        </div>

        <div className="hidden flex-nowrap items-center justify-between gap-3 sm:flex">
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
          <p className="min-h-9 text-[11px] leading-snug text-gray-03 sm:text-right">
            {loading ? "기준 시각 불러오는 중…" : (data?.asOfLabel ?? "")}
          </p>
        </div>

        <p className="w-full text-right text-[11px] leading-snug text-gray-03 sm:hidden">
          {loading ? "기준 시각 불러오는 중…" : (data?.asOfLabel ?? "")}
        </p>
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

          <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-3">
            <KpiCard
              title="총 리뷰 수"
              value={`${formatInt(data.current.totalReviews)}건`}
              delta={
                <GlancePercentDeltaLine
                  deltaPercent={data.deltas.reviewCount}
                  compact
                />
              }
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
                    <GlancePointsDeltaLine
                      delta={data.meta.ddangyoTastyRatioPoints}
                      suffix="%p"
                      compact
                    />
                  ) : (
                    <p className="typo-body-03-regular text-gray-03">
                      비교 불가
                    </p>
                  )
                ) : data.deltas.avgRating != null ? (
                  <GlancePointsDeltaLine
                    delta={data.deltas.avgRating}
                    suffix="점"
                    compact
                  />
                ) : (
                  <p className="typo-body-03-regular text-gray-03">비교 불가</p>
                )
              }
            />
            <KpiCard
              title="주문 수"
              value={`${formatInt(data.current.orderCount)}건`}
              delta={
                <GlancePercentDeltaLine
                  deltaPercent={data.deltas.orderCount}
                  compact
                />
              }
            />
          </div>

          <div className="grid min-w-0 gap-6 overflow-x-hidden xl:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]">
            <section className="rounded-lg border border-gray-07 bg-white p-4">
              <h2 className="typo-body-02-bold text-gray-04">
                주문 및 리뷰 추이
              </h2>

              <OrderReviewTrendLegend className="mt-4" />
              <div className="mt-4">
                <OrderReviewTrendChart series={data.series} />
              </div>
            </section>

            <section className="rounded-lg border border-gray-07 bg-white p-4">
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
    <div className="rounded-lg border border-gray-07 bg-white px-3 py-3 shadow-sm sm:px-4 sm:py-3">
      <p className="typo-body-02-bold text-gray-04">{title}</p>
      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
        <p className="typo-body-01-bold text-gray-01 tabular-nums">{value}</p>
        <div className="shrink-0">{delta}</div>
      </div>
      {footnote}
    </div>
  );
}
