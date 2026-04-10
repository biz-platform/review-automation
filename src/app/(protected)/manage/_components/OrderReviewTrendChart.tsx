"use client";

import { cn } from "@/lib/utils/cn";

/** 대시보드 glance API `series` 한 점 */
export type OrderReviewTrendPoint = {
  label: string;
  reviewCount: number;
  orderCount: number;
};

const PLOT_H_PX = 150;
/** 값 라벨( Body-03 ) + gap — 막대는 그 아래 영역만 사용 */
const LABEL_RESERVE_PX = 22;
const BAR_W_PX = 36;
const BAR_GAP_PX = 4;
/** Figma Group 94: 막대 둥근 모서리 8px */
const BAR_ROUND = "rounded-lg";

type OrderReviewTrendChartProps = {
  series: OrderReviewTrendPoint[];
  className?: string;
};

/**
 * Figma node 747:1780 — 주문 및 리뷰 추이 (클러스터 막대 + 그리드)
 * - 주문: MAIN-04, 리뷰: MAIN-03
 */
export function OrderReviewTrendChart({
  series,
  className,
}: OrderReviewTrendChartProps) {
  const compactAxis =
    series.length >= 4 || series.some((s) => s.label.length > 8);
  const max = Math.max(
    1,
    ...series.flatMap((s) => [s.orderCount, s.reviewCount]),
  );
  const barMaxH = PLOT_H_PX - LABEL_RESERVE_PX;

  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative isolate w-full"
        style={{ minHeight: PLOT_H_PX }}
      >
        {/* 가로 그리드 (Figma: 내부 #F6F6F6, 하단 기준선 gray-07) */}
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
            compactAxis ? "gap-1 sm:gap-2" : "gap-6 sm:gap-8 lg:gap-10",
          )}
        >
          {series.map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex min-w-0 flex-1 justify-center sm:flex-none",
                compactAxis ? "max-w-[56px] sm:max-w-[64px]" : "sm:max-w-[76px]",
              )}
            >
              <div
                className="flex items-end justify-center"
                style={{
                  gap: BAR_GAP_PX,
                  width: BAR_W_PX * 2 + BAR_GAP_PX,
                  maxWidth: "100%",
                }}
              >
                <TrendBar
                  value={s.orderCount}
                  max={max}
                  barMaxH={barMaxH}
                  barClassName="bg-main-04"
                />
                <TrendBar
                  value={s.reviewCount}
                  max={max}
                  barMaxH={barMaxH}
                  barClassName="bg-main-03"
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
              "min-w-0 flex-1 text-center text-gray-04 sm:flex-none",
              compactAxis
                ? "max-w-[64px] wrap-break-word text-[10px] leading-tight sm:text-[11px]"
                : "typo-body-02-regular sm:max-w-[76px]",
            )}
          >
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendBar({
  value,
  max,
  barMaxH,
  barClassName,
}: {
  value: number;
  max: number;
  barMaxH: number;
  barClassName: string;
}) {
  const rawPx = max > 0 ? (value / max) * barMaxH : 0;
  const hPx =
    value <= 0
      ? 0
      : Math.max(2, Math.round(rawPx));

  return (
    <div
      className="flex h-[150px] shrink-0 flex-col justify-end gap-1"
      style={{ width: BAR_W_PX }}
    >
      <span className="w-full shrink-0 text-center typo-body-03-regular text-gray-02 tabular-nums">
        {value}
      </span>
      <div
        className={cn(BAR_ROUND, "w-full shrink-0", hPx > 0 ? barClassName : "")}
        style={{ height: hPx }}
      />
    </div>
  );
}

/** 카드 상단 범례 (Figma: 원 14px + Body-02) */
export function OrderReviewTrendLegend({
  orderLabel = "주문 수",
  reviewLabel = "리뷰 수",
  className,
}: {
  orderLabel?: string;
  reviewLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-8 gap-y-2 typo-body-02-regular text-gray-04",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full bg-main-04"
          aria-hidden
        />
        {orderLabel}
      </span>
      <span className="inline-flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full bg-main-03"
          aria-hidden
        />
        {reviewLabel}
      </span>
    </div>
  );
}
