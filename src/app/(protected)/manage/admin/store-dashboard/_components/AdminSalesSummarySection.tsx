"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { WeekdayDemandBadge } from "@/components/ui/weekday-demand-badge";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  DashboardSalesData,
  DashboardSalesRange,
} from "@/entities/dashboard/sales-types";
import {
  SalesHourTrendChart,
  type SalesHourTrendPoint,
} from "@/app/(protected)/manage/_components/SalesHourTrendChart";
import { SalesMetricLegend } from "@/app/(protected)/manage/_components/SalesMetricLegend";
import { DashboardSectionCard } from "@/app/(protected)/manage/_components/DashboardSectionCard";

const PLATFORM_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "전체" },
  { value: "baemin", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "yogiyo", label: "요기요" },
  { value: "ddangyo", label: "땡겨요" },
];

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as {
      detail?: string;
      error?: string;
      title?: string;
      message?: string;
      code?: string;
    };
    const msg =
      err.detail ?? err.error ?? err.title ?? err.message ?? res.statusText;
    const e = new Error(msg) as Error & { code?: string };
    e.code = err.code;
    throw e;
  }
  return res.json();
}

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
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

export function AdminSalesSummarySection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const userId = searchParams.get("userId") ?? "";
  const storeId = searchParams.get("storeId") ?? "";
  const range = (searchParams.get("range") ?? "30d") as DashboardSalesRange;
  const platform = searchParams.get("platform") ?? "";

  const [data, setData] = useState<DashboardSalesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<0 | 1 | 2 | 3 | 4 | 5 | 6>(0);

  const setQuery = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") q.delete(k);
      else q.set(k, v);
    }
    router.replace(`${pathname}?${q.toString()}`);
  };

  useEffect(() => {
    if (!userId.trim() || !storeId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const sp = new URLSearchParams();
    sp.set("storeId", storeId);
    sp.set("range", range === "30d" ? "30d" : "7d");
    if (platform.trim()) sp.set("platform", platform.trim());
    const url = `${API_ENDPOINT.admin.storeDashboardSales(userId)}?${sp.toString()}`;
    void getJson<{ result: DashboardSalesData }>(url)
      .then((res) => {
        if (!cancelled) setData(res.result);
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
      if (r.orderCount > 0) hoursWithOrders.push(r.hour);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
          {PLATFORM_FILTERS.map((p) => {
            const checked = (platform || "") === p.value;
            return (
              <TagSelect
                key={p.value || "all"}
                variant={checked ? "checked" : "default"}
                onClick={() => setQuery({ platform: p.value || undefined })}
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
            description={`아침 시간대 매출은 안정적으로 유지되며 출근 수요가 꾸준하게 발생하고 있습니다.\n반면 월요일은 상대적으로 매출이 낮아, 재료 준비나 매장 점검 등 운영 효율을 높이는 시간으로 활용하기 적합합니다.`}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="총 매출"
              value={formatWon(data.current.totalPayAmount)}
              delta={
                <DeltaLine delta={data.deltas.totalPayAmount} suffix="원" />
              }
            />
            <KpiCard
              title="정산 금액"
              value={formatWon(data.current.settlementAmount)}
              delta={
                <DeltaLine delta={data.deltas.settlementAmount} suffix="원" />
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
                  <DeltaLine delta={data.deltas.avgOrderAmount} suffix="원" />
                ) : (
                  <p className="typo-body-03-regular text-gray-03">비교 불가</p>
                )
              }
            />
          </div>

          <div className="grid min-w-0 gap-6">
            <DashboardSectionCard title="매출 추이">
              <div className="mt-8 flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
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
                    <span className="relative inline-flex items-center px-0.5">
                      <span>{d.label}</span>
                      {weekdayBadges.chill.has(d.key) && (
                        <WeekdayDemandBadge
                          variant="chill"
                          className="absolute -right-3 -top-6"
                        >
                          여유
                        </WeekdayDemandBadge>
                      )}
                      {weekdayBadges.popular.has(d.key) && (
                        <WeekdayDemandBadge
                          variant="popular"
                          className="absolute -right-3 -top-6"
                        >
                          인기
                        </WeekdayDemandBadge>
                      )}
                    </span>
                  </TagSelect>
                ))}
              </div>
              <SalesMetricLegend className="mt-8" />
              <div className="mt-8">
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
}: {
  title: string;
  value: string;
  delta?: React.ReactNode;
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
