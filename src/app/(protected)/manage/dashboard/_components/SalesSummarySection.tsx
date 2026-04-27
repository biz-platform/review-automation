"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { WeekdayDemandBadge } from "@/components/ui/weekday-demand-badge";
import { getDashboardSales } from "@/entities/dashboard/api/dashboard-api";
import { getAdminStoreDashboardSales } from "@/entities/admin/api/store-api";
import type {
  DashboardSalesData,
  DashboardSalesRange,
} from "@/entities/dashboard/sales-types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { useAdminDashboardPlatformStores } from "@/app/(protected)/manage/admin/store-dashboard/_components/AdminDashboardPlatformStoresContext";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";
import {
  SalesHourTrendChart,
  type SalesHourTrendPoint,
} from "@/app/(protected)/manage/_components/SalesHourTrendChart";
import { SalesMetricLegend } from "@/app/(protected)/manage/_components/SalesMetricLegend";
import { DashboardSectionCard } from "@/app/(protected)/manage/_components/DashboardSectionCard";
import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import dateIcon from "@/assets/icons/24px/date.webp";
import Image from "next/image";
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
} from "@/components/ui/dropdown";
import { ContentStateMessage } from "@/components/ui/content-state-message";

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

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function DeltaLine({
  delta,
  suffix,
  isMoney,
}: {
  delta: number;
  suffix: string;
  isMoney?: boolean;
}) {
  const same = delta === 0;
  const up = delta > 0;
  if (same) {
    return (
      <p className="typo-body-03-regular text-gray-03">지난 기간과 동일</p>
    );
  }
  const abs = Math.abs(delta);
  const absText = isMoney ? formatInt(abs) : abs.toLocaleString("ko-KR");
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
      {absText}
      {suffix}
    </p>
  );
}

export type SalesSummarySectionProps = {
  variant?: "member" | "admin";
};

export function SalesSummarySection({
  variant = "member",
}: SalesSummarySectionProps) {
  if (variant === "admin") {
    return <SalesSummarySectionAdmin />;
  }
  return <SalesSummarySectionMember />;
}

function SalesSummarySectionMember() {
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
    void getDashboardSales({
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

  const platformFilters = PLATFORM_FILTERS;

  const platformFiltersWithDisabled = useMemo(
    () =>
      platformFilters.map((p) => ({
        ...p,
        disabled:
          !!p.value &&
          linkedPlatformsForStore != null &&
          !linkedPlatformsForStore.has(p.value),
      })),
    [platformFilters, linkedPlatformsForStore],
  );

  return (
    <SalesSummarySectionView
      loading={loading}
      error={error}
      data={data}
      platformFilters={platformFiltersWithDisabled}
      platform={platform}
      range={range}
      onSelectPlatform={(value) => setQuery({ platform: value || undefined })}
      onSelectRange={(value) => setQuery({ range: value })}
    />
  );
}

function SalesSummarySectionAdmin() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const userId = searchParams.get("userId") ?? "";
  const storeId = searchParams.get("storeId") ?? "";
  const range = (searchParams.get("range") ?? "30d") as DashboardSalesRange;
  const platform = searchParams.get("platform") ?? "";

  const { storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo } =
    useAdminDashboardPlatformStores();

  const linkedPlatformsForStore = useMemo(() => {
    return getDashboardChipLinkedPlatforms(storeId, DASHBOARD_ALL_STORES_ID, {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    });
  }, [storeId, storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo]);

  const [data, setData] = useState<DashboardSalesData | null>(null);
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

  useEffect(() => {
    if (!platform.trim()) return;
    if (linkedPlatformsForStore == null) return;
    if (linkedPlatformsForStore.has(platform)) return;
    setQuery({ platform: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, platform, linkedPlatformsForStore]);

  useEffect(() => {
    if (!userId.trim() || !storeId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getAdminStoreDashboardSales({
      userId,
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
  }, [userId, storeId, range, platform]);

  const platformFiltersWithDisabled = useMemo(
    () =>
      PLATFORM_FILTERS.map((p) => ({
        ...p,
        disabled:
          !!p.value &&
          linkedPlatformsForStore != null &&
          !linkedPlatformsForStore.has(p.value),
      })),
    [linkedPlatformsForStore],
  );

  return (
    <SalesSummarySectionView
      loading={loading}
      error={error}
      data={data}
      platformFilters={platformFiltersWithDisabled}
      platform={platform}
      range={range}
      onSelectPlatform={(value) => setQuery({ platform: value || undefined })}
      onSelectRange={(value) => setQuery({ range: value })}
    />
  );
}

type SalesSummarySectionViewProps = {
  loading: boolean;
  error: string | null;
  data: DashboardSalesData | null;
  platformFilters: { value: string; label: string; disabled: boolean }[];
  platform: string;
  range: DashboardSalesRange;
  onSelectPlatform: (value: string) => void;
  onSelectRange: (value: DashboardSalesRange) => void;
};

function SalesSummarySectionView({
  loading,
  error,
  data,
  platformFilters,
  platform,
  range,
  onSelectPlatform,
  onSelectRange,
}: SalesSummarySectionViewProps) {
  const [weekday, setWeekday] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);
  const [rangeOpen, setRangeOpen] = useState(false);

  useEffect(() => {
    const nowKst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
    );
    const d = nowKst.getDay();
    const kstWeekday = d === 0 ? 6 : d - 1;
    setWeekday(kstWeekday as 0 | 1 | 2 | 3 | 4 | 5 | 6);
  }, []);

  const hourSeries: SalesHourTrendPoint[] = useMemo(() => {
    const map = new Map<number, number>();
    const hoursWithOrders: number[] = [];
    for (const r of data?.weekdayHourSales ?? []) {
      if (r.weekday !== weekday) continue;
      map.set(r.hour, r.totalPayAmount);
      const pay = r.totalPayAmount ?? 0;
      const oc = r.orderCount ?? 0;
      if (pay > 0 || oc > 0) hoursWithOrders.push(r.hour);
    }
    if (hoursWithOrders.length === 0) return [];
    const minHour = Math.min(...hoursWithOrders);
    const maxHour = Math.max(...hoursWithOrders);
    const out: SalesHourTrendPoint[] = [];
    for (let h = minHour; h <= maxHour; h++) {
      out.push({ hour: h, totalPayAmount: map.get(h) ?? 0 });
    }
    return out;
  }, [data?.weekdayHourSales, weekday]);

  const selectedWeekdaySalesTotal = useMemo(() => {
    let sum = 0;
    for (const r of data?.weekdayHourSales ?? []) {
      if (r.weekday !== weekday) continue;
      sum += r.totalPayAmount;
    }
    return sum;
  }, [data?.weekdayHourSales, weekday]);

  const weekdayBadges = useMemo(() => {
    const sums = Array.from({ length: 7 }, (_, i) => ({
      weekday: i as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      sum: 0,
    }));
    for (const r of data?.weekdayHourSales ?? []) {
      sums[r.weekday].sum += r.totalPayAmount;
    }
    if (sums.every((s) => s.sum === 0))
      return { popular: new Set<number>(), chill: new Set<number>() };

    const sorted = [...sums].sort((a, b) => b.sum - a.sum);
    const popular = new Set<number>(sorted.slice(0, 2).map((x) => x.weekday));
    const chill = new Set<number>([sorted[sorted.length - 1]?.weekday ?? 0]);
    return { popular, chill };
  }, [data?.weekdayHourSales]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        {/* mobile: dropdown + calendar, desktop: chips */}
        <div className="flex items-center gap-2 sm:hidden">
          <MaskedNativeSelect
            uiSize="sm"
            value={platform}
            onChange={(e) => onSelectPlatform(e.target.value)}
            wrapperClassName="min-w-0 flex-1"
            className="bg-white"
          >
            {platformFilters.map((p) => (
              <option
                key={p.value || "all"}
                value={p.value}
                disabled={p.disabled}
              >
                {p.value ? `${p.label}` : "플랫폼 전체"}
              </option>
            ))}
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
                onSelect={() => onSelectRange("30d")}
                className={range === "30d" ? "bg-gray-08" : undefined}
              >
                한 달
              </DropdownItem>
              <DropdownItem
                onSelect={() => onSelectRange("7d")}
                className={range === "7d" ? "bg-gray-08" : undefined}
              >
                최근 7일
              </DropdownItem>
            </DropdownContent>
          </DropdownRoot>
        </div>

        <div className="hidden flex-nowrap items-center justify-between gap-3 sm:flex">
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
            {platformFilters.map((p) => {
              const checked = (platform || "") === p.value;
              return (
                <TagSelect
                  key={p.value || "all"}
                  disabled={p.disabled}
                  variant={
                    p.disabled ? "disabled" : checked ? "checked" : "default"
                  }
                  onClick={() => {
                    if (p.disabled) return;
                    onSelectPlatform(p.value);
                  }}
                >
                  {p.label}
                </TagSelect>
              );
            })}
          </div>
          <p className="min-h-9 text-[11px] leading-snug text-gray-03 flex items-center sm:text-right">
            {loading ? "기준 시각 불러오는 중…" : (data?.asOfLabel ?? "")}
          </p>
        </div>

        <p className="w-full text-right text-[11px] leading-snug text-gray-03 sm:hidden">
          {loading ? "기준 시각 불러오는 중…" : (data?.asOfLabel ?? "")}
        </p>
      </div>

      {loading && (
        <ContentStateMessage
          variant="loading"
          message="데이터를 불러오는 중…"
          className="min-h-64"
        />
      )}
      {error && <p className="typo-body-02-regular text-red-600">{error}</p>}

      {data && !loading && (
        <>
          <Info
            title="AI 분석"
            description={
              data.aiInsights?.sales?.text ??
              "인사이트를 불러오지 못했어요. 새로고침 후 다시 시도해 주세요."
            }
          />

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <KpiCard
              title="총 매출"
              className="col-span-2 md:col-span-1"
              value={formatWon(data.current.totalPayAmount)}
              delta={
                <DeltaLine
                  delta={data.deltas.totalPayAmount}
                  suffix="원"
                  isMoney
                />
              }
            />
            <KpiCard
              title="정산 금액"
              value={formatWon(data.current.settlementAmount)}
              delta={
                <DeltaLine
                  delta={data.deltas.settlementAmount}
                  suffix="원"
                  isMoney
                />
              }
            />
            <KpiCard
              title="평균 주문 금액"
              value={
                data.current.avgOrderAmount != null
                  ? formatWon(data.current.avgOrderAmount)
                  : "—"
              }
              delta={
                data.deltas.avgOrderAmount != null ? (
                  <DeltaLine
                    delta={data.deltas.avgOrderAmount}
                    suffix="원"
                    isMoney
                  />
                ) : (
                  <p className="typo-body-03-regular text-gray-03">비교 불가</p>
                )
              }
            />
          </div>

          <div className="grid min-w-0 gap-6">
            <DashboardSectionCard title="매출 추이">
              <div className="mt-6 flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide max-md:mt-2 max-md:min-h-10 max-md:items-end md:min-h-0 md:flex-wrap md:items-center md:overflow-visible">
                {[
                  { key: 0, label: "월요일" },
                  { key: 1, label: "화요일" },
                  { key: 2, label: "수요일" },
                  { key: 3, label: "목요일" },
                  { key: 4, label: "금요일" },
                  { key: 5, label: "토요일" },
                  { key: 6, label: "일요일" },
                ].map((d) => (
                  <TagSelect
                    key={d.key}
                    variant={weekday === d.key ? "checked" : "default"}
                    onClick={() =>
                      setWeekday(d.key as 0 | 1 | 2 | 3 | 4 | 5 | 6)
                    }
                  >
                    <span className="relative inline-flex items-center px-0.5 pt-1">
                      <span>{d.label}</span>
                      {weekdayBadges.chill.has(d.key) && (
                        <WeekdayDemandBadge
                          variant="chill"
                          className="absolute -right-3 -top-6 z-10 max-sm:-right-2 max-sm:-top-3 max-sm:scale-[0.92] max-sm:px-1 max-sm:py-px max-sm:text-[9px] max-sm:leading-none"
                        >
                          여유
                        </WeekdayDemandBadge>
                      )}
                      {weekdayBadges.popular.has(d.key) && (
                        <WeekdayDemandBadge
                          variant="popular"
                          className="absolute -right-3 -top-6 z-10 max-sm:-right-2 max-sm:-top-3 max-sm:scale-[0.92] max-sm:px-1 max-sm:py-px max-sm:text-[9px] max-sm:leading-none"
                        >
                          인기
                        </WeekdayDemandBadge>
                      )}
                    </span>
                  </TagSelect>
                ))}
              </div>
              <div className="mt-5 flex flex-row flex-wrap items-center gap-2">
                <SalesMetricLegend className="shrink-0" />
                <p className="flex items-center typo-body-02-regular tabular-nums">
                  <span className="font-medium text-gray-01">
                    - {formatWon(selectedWeekdaySalesTotal)}
                  </span>
                </p>
              </div>
              <div className="mt-6 min-w-0">
                {hourSeries.length > 0 ? (
                  <SalesHourTrendChart series={hourSeries} />
                ) : (
                  <div className="rounded-lg border border-border bg-gray-08 px-4 py-10 text-center typo-body-02-regular text-gray-03">
                    해당 요일에 주문이 없어요.
                  </div>
                )}
              </div>
            </DashboardSectionCard>
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
  className,
}: {
  title: string;
  value: string;
  delta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[#D9D9D9] bg-white p-4",
        className,
      )}
    >
      <p className="typo-body-03-regular text-gray-03">{title}</p>
      <p className="mt-2 typo-heading-02-bold text-gray-01 tabular-nums">
        {value}
      </p>
      <div className="mt-1">{delta}</div>
    </div>
  );
}
