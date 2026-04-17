"use client";

import { formatDashboardChartAxisLabel } from "@/lib/dashboard/format-dashboard-chart-axis-label";
import { useMobileChartAxisOmitYear } from "@/lib/hooks/use-mobile-chart-axis-omit-year";
import { cn } from "@/lib/utils/cn";

export type ReviewRatingTrendPoint = {
  label: string;
  reviewCount: number;
  avgRating: number | null;
};

const PLOT_H_PX = 150;
/** 값 라벨( Body-03 ) + gap — 막대는 그 아래 영역만 사용 */
const LABEL_RESERVE_PX = 22;
const BAR_GAP_PX = 4;
const BAR_ROUND = "rounded-lg";

type ReviewRatingTrendChartProps = {
  series: ReviewRatingTrendPoint[];
  className?: string;
};

/**
 * 리뷰 분석: 리뷰 수(연한 막대) + 주·일별 평균 별점(진한 막대). 스케일 각각 독립.
 */
export function ReviewRatingTrendChart({
  series,
  className,
}: ReviewRatingTrendChartProps) {
  const omitChartYear = useMobileChartAxisOmitYear();
  const compactAxis =
    series.length >= 4 || series.some((s) => s.label.length > 10);
  const countMax = Math.max(1, ...series.map((s) => s.reviewCount));
  const ratingNums = series
    .map((s) => s.avgRating)
    .filter((x): x is number => x != null && Number.isFinite(x));
  const ratingMax = Math.max(1, ...ratingNums, 0.1);

  const barMaxH = PLOT_H_PX - LABEL_RESERVE_PX;

  return (
    <div className={cn("w-full min-w-0 max-w-full", className)}>
      <div className="relative isolate w-full" style={{ minHeight: PLOT_H_PX }}>
        <div
          className="pointer-events-none absolute inset-0 z-0 border-b border-gray-07"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, #f6f6f6 0, #f6f6f6 1px, transparent 1px, transparent 30px)",
            backgroundSize: `100% ${PLOT_H_PX}px`,
          }}
          aria-hidden
        />

        <div
          className={cn(
            "relative z-1 flex w-full items-end justify-between px-1",
            compactAxis ? "gap-4" : "gap-4 sm:gap-5 lg:gap-6",
          )}
        >
          {series.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-1 justify-center",
                compactAxis
                  ? "max-w-[min(100%,4rem)]"
                  : "max-w-[min(100%,5rem)]",
              )}
            >
              <div
                className="flex w-full min-w-0 max-w-20 items-end justify-center"
                style={{ gap: BAR_GAP_PX }}
              >
                <DualTrendBar
                  numericValue={s.reviewCount}
                  max={countMax}
                  barMaxH={barMaxH}
                  displayLabel={String(s.reviewCount)}
                  barClassName="bg-main-04"
                />
                <DualTrendBar
                  numericValue={s.avgRating ?? 0}
                  max={ratingMax}
                  barMaxH={barMaxH}
                  displayLabel={
                    s.avgRating == null ? "—" : s.avgRating.toFixed(1)
                  }
                  barClassName="bg-main-02"
                  isEmpty={s.avgRating == null}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 flex w-full flex-wrap justify-between gap-x-1 gap-y-1 px-0.5">
        {series.map((s) => (
          <span
            key={`${s.label}-axis`}
            className={cn(
              "min-w-0 flex-1 text-center text-gray-04",
              compactAxis
                ? "max-w-[min(100%,4rem)] wrap-break-word text-[10px] leading-tight sm:text-[11px]"
                : "typo-body-02-regular max-w-[min(100%,5rem)]",
            )}
          >
            {formatDashboardChartAxisLabel(s.label, omitChartYear)}
          </span>
        ))}
      </div>
    </div>
  );
}

function DualTrendBar({
  numericValue,
  max,
  barMaxH,
  displayLabel,
  barClassName,
  isEmpty,
}: {
  numericValue: number;
  max: number;
  barMaxH: number;
  displayLabel: string;
  barClassName: string;
  isEmpty?: boolean;
}) {
  const rawPx = max > 0 ? (numericValue / max) * barMaxH : 0;
  const hPx = isEmpty || numericValue <= 0 ? 0 : Math.max(2, Math.round(rawPx));

  return (
    <div className="flex h-[150px] min-w-[6px] max-w-7 flex-1 basis-[40%] flex-col justify-end gap-1">
      <span className="w-full shrink-0 text-center typo-body-03-regular text-gray-02 tabular-nums">
        {displayLabel}
      </span>
      <div
        className={cn(
          BAR_ROUND,
          "w-full shrink-0",
          hPx > 0 ? barClassName : "",
        )}
        style={{ height: hPx }}
      />
    </div>
  );
}

export function ReviewRatingTrendLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 typo-body-02-regular text-gray-02",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-3.5 shrink-0 rounded-full bg-main-04"
          aria-hidden
        />
        리뷰 수
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-block size-3.5 shrink-0 rounded-full bg-main-02"
          aria-hidden
        />
        별점
      </span>
    </div>
  );
}
