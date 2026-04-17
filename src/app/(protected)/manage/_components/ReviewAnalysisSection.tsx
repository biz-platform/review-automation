"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { TagSelect } from "@/components/ui/tag-select";
import { Info } from "@/components/ui/info";
import { getDashboardReviewAnalysis } from "@/entities/dashboard/api/dashboard-api";
import { getAdminStoreDashboardReviews } from "@/entities/admin/api/store-api";
import type { DashboardReviewAnalysisData } from "@/entities/dashboard/reviews-types";
import type { DashboardRange } from "@/entities/dashboard/types";
import { parseAdminDashboardRangeParam } from "@/entities/admin/types";
import { DASHBOARD_ALL_STORES_ID } from "@/entities/dashboard/constants";
import { useReviewsManageStores } from "@/app/(protected)/manage/reviews/reviews-manage/use-reviews-manage-stores";
import { getDashboardChipLinkedPlatforms } from "@/lib/dashboard/dashboard-store-platforms";
import { DashboardSectionCard } from "@/app/(protected)/manage/_components/DashboardSectionCard";
import {
  ReviewKeywordReviewsModal,
  type ReviewKeywordModalSelection,
} from "@/app/(protected)/manage/_components/ReviewKeywordReviewsModal";
import {
  ReviewRatingTrendChart,
  ReviewRatingTrendLegend,
} from "@/app/(protected)/manage/_components/ReviewRatingTrendChart";
import { Button } from "@/components/ui/button";
import { useAdminDashboardPlatformStores } from "@/app/(protected)/manage/admin/store-dashboard/_components/AdminDashboardPlatformStoresContext";
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

export type ReviewAnalysisSectionVariant = "member" | "admin";

export function ReviewAnalysisSection({
  variant,
}: {
  variant: ReviewAnalysisSectionVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const adminUserId = searchParams.get("userId") ?? "";
  const storeId = searchParams.get("storeId") ?? "";
  const rangeRaw = searchParams.get("range");
  const range =
    variant === "admin"
      ? parseAdminDashboardRangeParam(rangeRaw)
      : ((rangeRaw === "7d" || rangeRaw === "30d"
          ? rangeRaw
          : "30d") as DashboardRange);
  const platform = searchParams.get("platform") ?? "";

  const memberStores = useReviewsManageStores("");
  const adminStores = useAdminDashboardPlatformStores();
  const { storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo } =
    variant === "member" ? memberStores : adminStores;

  const linkedPlatformsForStore = useMemo(() => {
    return getDashboardChipLinkedPlatforms(storeId, DASHBOARD_ALL_STORES_ID, {
      storesBaemin,
      storesCoupangEats,
      storesDdangyo,
      storesYogiyo,
    });
  }, [storeId, storesBaemin, storesCoupangEats, storesDdangyo, storesYogiyo]);

  const [data, setData] = useState<DashboardReviewAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [keywordSelection, setKeywordSelection] =
    useState<ReviewKeywordModalSelection | null>(null);

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
    if (variant === "admin" && !adminUserId.trim()) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const req = {
      storeId,
      range,
      platform: platform || undefined,
    };
    const p =
      variant === "member"
        ? getDashboardReviewAnalysis(req)
        : getAdminStoreDashboardReviews({ userId: adminUserId, ...req });
    void p
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
  }, [variant, adminUserId, storeId, range, platform]);

  if (!storeId.trim()) return null;
  if (variant === "admin" && !adminUserId.trim()) return null;

  return (
    <div className="flex flex-col gap-6">
      <ReviewKeywordReviewsModal
        variant={variant}
        adminUserId={adminUserId}
        storeId={storeId}
        range={range}
        platform={platform}
        selection={keywordSelection}
        onClose={() => setKeywordSelection(null)}
      />
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
          <p
            className={cn(
              "min-h-9 text-[11px] leading-snug text-gray-03",
              "flex max-w-[220px] items-center sm:max-w-none sm:text-right",
            )}
          >
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

          <div className="grid min-w-0 gap-6 lg:grid-cols-2">
            <DashboardSectionCard title="">
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="typo-body-03-bold text-gray-03">리뷰 수</p>
                  <p className="mt-1 typo-heading-02-bold text-gray-01 tabular-nums">
                    {formatInt(data.totalReviews)}건
                  </p>
                </div>
                <div>
                  <p className="typo-body-03-bold text-gray-03">평균 별점</p>
                  <p className="mt-1 typo-heading-02-bold text-gray-01 tabular-nums">
                    {data.avgRating != null
                      ? `${data.avgRating.toFixed(1)}점`
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="mt-4 h-px w-full bg-gray-07" />

              <div className="mt-6 flex flex-col gap-3">
                {data.starDistribution.map((row) => (
                  <div
                    key={row.star}
                    className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2"
                  >
                    <span className="typo-body-02-regular text-gray-03 tabular-nums">
                      {row.star}점
                    </span>
                    <div className="h-3 min-w-0 overflow-hidden rounded bg-gray-08">
                      <div
                        className="h-full rounded bg-main-03"
                        style={{
                          width:
                            data.totalReviews > 0
                              ? `${(row.count / data.totalReviews) * 100}%`
                              : "0%",
                        }}
                      />
                    </div>
                    <span className="text-right typo-body-02-regular text-gray-02 tabular-nums">
                      {row.percent}%
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[11px] leading-snug text-gray-03">
                땡겨요 맛있어요 지수(5점)는 별점 분포에서 제외돼요.
              </p>
            </DashboardSectionCard>

            <DashboardSectionCard title="리뷰 추이">
              <ReviewRatingTrendLegend className="mt-4" />
              <div className="mt-4">
                <ReviewRatingTrendChart series={data.trend} />
              </div>
            </DashboardSectionCard>
          </div>

          <DashboardSectionCard title="키워드 분석">
            <div className="mt-4 flex flex-col gap-4">
              <div>
                <p className="typo-body-02-bold text-blue-01">긍정 키워드</p>
                {data.keywords.positive.length === 0 ? (
                  <p className="mt-2 typo-body-03-regular text-gray-03">
                    조건을 만족하는 긍정 키워드가 없어요.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.keywords.positive.map((k) => (
                      <Button
                        key={k.keyword}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-0 rounded-lg border border-blue-02 bg-blue-03 px-3 py-1 typo-body-03-regular text-blue-01 shadow-none outline-none hover:bg-blue-03/85 hover:outline-none"
                        onClick={() =>
                          setKeywordSelection({
                            keyword: k.keyword,
                            sentiment: "positive",
                          })
                        }
                      >
                        {k.keyword}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="typo-body-02-bold text-red-02">
                  개선이 필요한 키워드
                </p>
                {data.keywords.negative.length === 0 ? (
                  <p className="mt-2 typo-body-03-regular text-gray-03">
                    조건을 만족하는 키워드가 없어요.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.keywords.negative.map((k) => (
                      <Button
                        key={k.keyword}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto min-h-0 rounded-lg border border-red-02/50 bg-red-02/10 px-3 py-1 typo-body-03-regular text-red-02 shadow-none outline-none hover:bg-red-02/15 hover:outline-none"
                        onClick={() =>
                          setKeywordSelection({
                            keyword: k.keyword,
                            sentiment: "negative",
                          })
                        }
                      >
                        {k.keyword}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </DashboardSectionCard>
        </>
      )}
    </div>
  );
}
