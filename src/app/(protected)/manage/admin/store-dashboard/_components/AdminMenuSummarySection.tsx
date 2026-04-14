"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { API_ENDPOINT } from "@/const/endpoint";
import type {
  DashboardSalesData,
  DashboardSalesRange,
} from "@/entities/dashboard/sales-types";
import { DashboardSectionCard } from "@/app/(protected)/manage/_components/DashboardSectionCard";
import { TopMenusTable } from "@/app/(protected)/manage/_components/TopMenusTable";

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

function buildMenuInsightText(data: DashboardSalesData): string {
  const top = data.topMenus?.[0];
  if (!top) {
    return "기간 내 집계된 메뉴 매출 데이터가 아직 없어요.\n주문 데이터가 쌓이면 메뉴별 매출/비중을 기준으로 핵심 메뉴를 바로 짚어드릴게요.";
  }
  const share =
    top.shareOfRevenuePercent != null
      ? `${top.shareOfRevenuePercent.toFixed(1)}%`
      : "—";
  return `${top.menuName}가 메뉴 매출 비중 ${share}로 가장 강하게 팔리고 있어요.\n상위 메뉴 쏠림이 큰 편이라면 세트/사이드 묶기나 대체 메뉴 노출로 분산을 시도해봐도 좋아요.`;
}

export function AdminMenuSummarySection() {
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

  const kpis = useMemo(() => {
    if (!data) return null;
    const menuCount = data.topMenus?.length ?? 0;
    const totalQty = (data.topMenus ?? []).reduce((acc, r) => acc + (r.quantity ?? 0), 0);
    const top = data.topMenus?.[0];
    return {
      menuCount,
      totalQty,
      bestMenuLabel: top
        ? `${top.menuName}${top.shareOfRevenuePercent != null ? ` (${top.shareOfRevenuePercent.toFixed(1)}%)` : ""}`
        : "—",
      bestMenuRevenue: top ? formatWon(top.lineTotal) : "—",
    };
  }, [data]);

  return (
    <div className="min-w-0">
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-visible">
        {PLATFORM_FILTERS.map((p) => (
          <TagSelect
            key={p.value || "all"}
            variant={platform === p.value ? "checked" : "default"}
            onClick={() => setQuery({ platform: p.value || undefined })}
          >
            {p.label}
          </TagSelect>
        ))}
      </div>

      <div className="mt-4">
        <Info
          title="AI 분석"
          description={
            data ? buildMenuInsightText(data) : "메뉴 매출 데이터를 분석 중이에요."
          }
        />
      </div>

      {loading ? (
        <p className="mt-6 typo-body-02-regular text-gray-03">불러오는 중…</p>
      ) : error ? (
        <p className="mt-6 typo-body-02-regular text-red-500">{error}</p>
      ) : !data ? (
        <p className="mt-6 typo-body-02-regular text-gray-03">
          데이터가 없습니다.
        </p>
      ) : (
        <>
          <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-3">
            <KpiCard title="판매 메뉴 수" value={`${formatInt(kpis?.menuCount ?? 0)}개`} />
            <KpiCard title="판매된 메뉴" value={`${formatInt(kpis?.totalQty ?? 0)}개`} />
            <KpiCard
              title="베스트 메뉴"
              value={kpis?.bestMenuLabel ?? "—"}
              subValue={kpis?.bestMenuRevenue}
            />
          </div>

          <div className="mt-6">
            <DashboardSectionCard
              title="상위 메뉴"
              description="기간 내 메뉴별 매출 합산(상위 8개)"
            >
              <TopMenusTable rows={data.topMenus} />
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
  subValue,
}: {
  title: string;
  value: string;
  subValue?: string;
}) {
  return (
    <div className="rounded-lg border border-[#D9D9D9] bg-white p-4">
      <p className="typo-body-03-regular text-gray-03">{title}</p>
      <p className="mt-2 typo-heading-02-bold text-gray-01 tabular-nums">
        {value}
      </p>
      {subValue ? (
        <p className="mt-1 typo-body-03-regular text-gray-03 tabular-nums">
          {subValue}
        </p>
      ) : null}
    </div>
  );
}

