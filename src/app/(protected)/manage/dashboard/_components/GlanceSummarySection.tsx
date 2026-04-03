"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { PLATFORM_LABEL } from "@/const/platform";
import { getDashboardGlance } from "@/entities/dashboard/api/dashboard-api";
import type { DashboardGlanceData, DashboardRange } from "@/entities/dashboard/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";

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

  const storeId = searchParams.get("storeId") ?? "";
  const range = (searchParams.get("range") ?? "30d") as DashboardRange;
  const platform = searchParams.get("platform") ?? "";

  const {
    storesBaemin,
    storesCoupangEats,
    storesDdangyo,
    storesYogiyo,
  } = useReviewsManageStores("");

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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                  chipDisabled
                    ? "disabled"
                    : checked
                      ? "checked"
                      : "default"
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
        <p
          className={cn(
            "min-h-9 text-[11px] leading-snug text-gray-03",
            "flex max-w-[220px] items-center sm:max-w-none sm:text-right",
          )}
        >
          {loading
            ? "기준 시각 불러오는 중…"
            : (data?.asOfLabel ?? "")}
        </p>
      </div>

      {loading && (
        <p className="typo-body-02-regular text-gray-03">데이터를 불러오는 중…</p>
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
              value={`${formatInt(data.current.totalReviews)}건`}
              delta={<DeltaLine delta={data.deltas.reviewCount} suffix="건" />}
            />
            <KpiCard
              title="평균 평점"
              value={
                data.current.avgRating != null
                  ? `${data.current.avgRating.toFixed(1)}점`
                  : "—"
              }
              delta={
                data.deltas.avgRating != null ? (
                  <DeltaLine delta={data.deltas.avgRating} suffix="점" />
                ) : (
                  <p className="typo-body-03-regular text-gray-03">비교 불가</p>
                )
              }
            />
            <KpiCard
              title="주문 수"
              value={`${formatInt(data.current.orderCountEstimated)}건`}
              delta={
                <DeltaLine
                  delta={data.deltas.orderCountEstimated}
                  suffix="건"
                />
              }
              footnote={
                data.meta.ordersEstimated ? (
                  <p className="mt-1 text-[11px] leading-snug text-gray-03">
                    ※ 리뷰 대비 추정값입니다. 플랫폼 주문 API 연동 시 교체됩니다.
                  </p>
                ) : null
              }
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <h2 className="typo-body-01-bold text-gray-01">주문 및 리뷰 추이</h2>
              <p className="mt-1 text-[11px] leading-snug text-gray-03">
                {data.seriesMode === "day" ? "일별" : "주별"} · 주문은 추정치입니다.
              </p>
              <div className="mt-6 border-b border-border pb-2">
                <ClusteredBars series={data.series} />
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] leading-snug text-gray-03">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-main-03" /> 주문 수(추정)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm bg-main-01" /> 리뷰 수
                </span>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-white p-4 shadow-sm">
              <h2 className="typo-body-01-bold text-gray-01">플랫폼별 현황</h2>
              <p className="mt-1 text-[11px] leading-snug text-gray-03">
                선택한 기간·필터 기준
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {data.platformBreakdown.map((row) => (
                  <li
                    key={row.platform}
                    className="flex items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <span className="typo-body-03-bold text-gray-01">
                      {PLATFORM_LABEL[row.platform] ?? row.platform}
                    </span>
                    <div className="text-right">
                      <p className="typo-body-02-bold text-gray-01">
                        {row.avgRating != null ? `${row.avgRating.toFixed(1)}점` : "—"}
                      </p>
                      <p className="text-[11px] leading-snug text-gray-03">
                        주문 {formatInt(row.orderCountEstimated)}건
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
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

function ClusteredBars({ series }: { series: DashboardGlanceData["series"] }) {
  const max = Math.max(
    1,
    ...series.flatMap((s) => [s.orderCountEstimated, s.reviewCount]),
  );
  return (
    <div className="flex w-full items-end justify-between gap-1">
      {series.map((s) => (
        <div key={s.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="flex h-[168px] w-full items-stretch justify-center gap-0.5 px-0.5">
            <Bar value={s.orderCountEstimated} max={max} className="bg-main-03" />
            <Bar value={s.reviewCount} max={max} className="bg-main-01" />
          </div>
          <span className="truncate text-[10px] text-gray-03">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

function Bar({
  value,
  max,
  className,
}: {
  value: number;
  max: number;
  className: string;
}) {
  const pct = max > 0 ? Math.max(6, (value / max) * 100) : 0;
  return (
    <div className="flex h-full min-w-[8px] flex-1 flex-col items-center justify-end gap-0.5">
      <span className="text-[10px] leading-none text-gray-02">{value}</span>
      <div className={cn("w-full rounded-t", className)} style={{ height: `${pct}%` }} />
    </div>
  );
}

