"use client";

import Image from "next/image";
import { PlatformIcon } from "@/components/store/PlatformIcon";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_DASHBOARD_BADGE_BG, PLATFORM_LABEL } from "@/const/platform";
import { cn } from "@/lib/utils/cn";
import yumIcon from "@/assets/icons/14px/yum.svg";

export type DashboardPlatformBreakdownRow = {
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo";
  avgRating: number | null;
  tastyRatioPercent: number | null;
  reviewCount: number;
};

type DashboardPlatformBreakdownListProps = {
  rows: DashboardPlatformBreakdownRow[];
};

/** ReviewManageCard 등과 동일 계열 브랜드 톤 (윤곽 배지) */
const PLATFORM_BADGE_RING: Record<
  DashboardPlatformBreakdownRow["platform"],
  string
> = {
  baemin: "border-[#007D88] text-[#007D88]",
  coupang_eats: "border-blue-01 text-blue-01",
  yogiyo: "border-[#C60000] text-[#C60000]",
  ddangyo: "border-[#EA5E00] text-[#EA5E00]",
};

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

export function DashboardPlatformBreakdownList({
  rows,
}: DashboardPlatformBreakdownListProps) {
  return (
    <ul className="mt-4 flex flex-col">
      {rows.map((row) => (
        <li
          key={row.platform}
          className="flex items-center gap-3 border-b border-border py-3 first:pt-0 last:border-0 last:pb-0"
        >
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-white">
            <PlatformIcon platform={row.platform} />
          </div>
          <span className="min-w-0 flex-1 truncate typo-body-03-bold text-gray-01">
            {PLATFORM_LABEL[row.platform] ?? row.platform}
          </span>
          {/* 평점(우측 정렬) | 기준선 | 리뷰 수(좌측 정렬) */}
          <div className="flex min-w-0 shrink-0 items-center">
            <div className="flex w-[120px] justify-end sm:w-[148px]">
              <Badge
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-center typo-body-03-regular tabular-nums",
                  PLATFORM_BADGE_RING[row.platform],
                  "bg-(--platform-badge-bg)",
                )}
                style={
                  {
                    ["--platform-badge-bg" as string]:
                      PLATFORM_DASHBOARD_BADGE_BG[row.platform],
                  } as React.CSSProperties
                }
              >
                {row.platform === "ddangyo" ? (
                  row.tastyRatioPercent != null ? (
                    <span className="inline-flex items-center gap-1">
                      <span>{row.tastyRatioPercent}%</span>
                      <Image
                        src={yumIcon}
                        alt="맛있어요"
                        width={14}
                        height={14}
                        className="shrink-0"
                      />
                    </span>
                  ) : (
                    "—"
                  )
                ) : row.avgRating != null ? (
                  `${row.avgRating.toFixed(1)}점`
                ) : (
                  "—"
                )}
              </Badge>
            </div>

            <span className="mx-3 h-5 w-px shrink-0 bg-border" aria-hidden />

            <span className="w-[44px] shrink-0 text-left typo-body-02-bold tabular-nums text-gray-01 sm:w-[56px]">
              {formatInt(row.reviewCount)}개
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
