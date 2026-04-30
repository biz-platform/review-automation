"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { shouldShowHourChartAxisLabel } from "@/lib/utils/hour-chart-axis";

export type SalesHourTrendPoint = {
  hour: number;
  /** 원 */
  totalPayAmount: number;
};

const PLOT_H_PX = 150;
/** 모바일에서 막대가 과하게 넓어 보이지 않도록 */
const BAR_COL_CLASS =
  "w-full min-w-0 max-w-[10px] min-[380px]:max-w-[12px] sm:max-w-[16px] md:max-w-[22px]";
const BAR_FILL_ROUND = "rounded-md sm:rounded-lg";
/** 좁은 뷰에서 Y축 열 너비 */
const Y_AXIS_PAD = "clamp(2rem, 5.5vw, 3.5rem)";
const PLOT_PX_X = 4;

const plotGridTemplate = `${Y_AXIS_PAD} minmax(0, 1fr)`;

function formatWonCompact(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 100000000) return `${Math.round(n / 10000000) / 10}억`;
  if (abs >= 10000) return `${Math.round(n / 1000) / 10}만`;
  return n.toLocaleString("ko-KR");
}

function formatHourLabel(h: number): string {
  if (h === 0) return "0";
  if (h === 12) return "12";
  return String(h);
}

export function SalesHourTrendChart({
  series,
  className,
}: {
  series: SalesHourTrendPoint[];
  className?: string;
}) {
  const max = Math.max(1, ...series.map((s) => s.totalPayAmount));
  const barMaxH = PLOT_H_PX;
  const axisMinHour = series[0]?.hour ?? 0;
  const axisMaxHour = series[series.length - 1]?.hour ?? 0;

  const plotRef = useRef<HTMLDivElement | null>(null);

  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [tooltipLeftPx, setTooltipLeftPx] = useState<number | null>(null);
  const hovered = useMemo(() => {
    if (hoveredHour == null) return null;
    return series.find((s) => s.hour === hoveredHour) ?? null;
  }, [hoveredHour, series]);

  const yTicks = useMemo(() => {
    const t = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
    return [...new Set(t)].sort((a, b) => b - a);
  }, [max]);

  return (
    <div className={cn("w-full min-w-0", className)}>
      <div
        className="grid w-full min-w-0 max-w-full"
        style={{
          height: PLOT_H_PX,
          gridTemplateColumns: plotGridTemplate,
        }}
      >
        {/* Y축 숫자 */}
        <div className="relative h-full min-h-0" aria-hidden>
          {yTicks.map((t) => (
            <span
              key={`tick-${t}`}
              className="absolute left-0 right-0 pr-2 text-right text-[10px] leading-none text-gray-03 tabular-nums"
              style={{
                top: `${(1 - t / max) * 100}%`,
                transform: "translateY(-50%)",
              }}
            >
              {t === 0 ? "0" : `${formatWonCompact(t)}원`}
            </span>
          ))}
        </div>

        {/* 플롯: 가로 눈금 + 막대 (paddingLeft 없이 독립 열) */}
        <div className="relative h-full min-h-0 min-w-0">
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            {yTicks.map((t) => (
              <div
                key={`grid-${t}`}
                className="absolute left-0 right-0 h-px bg-gray-08"
                style={{
                  top: `${(1 - t / max) * 100}%`,
                  transform: "translateY(-50%)",
                }}
              />
            ))}
          </div>

          <div
            ref={plotRef}
            className="relative z-1 flex h-full min-h-0 w-full items-end justify-between gap-x-0.5 sm:gap-x-1"
            style={{
              paddingLeft: PLOT_PX_X,
              paddingRight: PLOT_PX_X,
            }}
          >
            {series.map((s) => (
              <div
                key={s.hour}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className={cn(
                    "flex flex-col items-center justify-end self-center",
                    BAR_COL_CLASS,
                  )}
                >
                  <HourBar
                    hour={s.hour}
                    value={s.totalPayAmount}
                    max={max}
                    barMaxH={barMaxH}
                    barClassName="bg-main-04"
                    hovered={hoveredHour === s.hour}
                    onHoverChange={(nextHour, anchorEl) => {
                      setHoveredHour(nextHour);
                      if (!plotRef.current || !anchorEl || nextHour == null) {
                        setTooltipLeftPx(null);
                        return;
                      }
                      const plotRect = plotRef.current.getBoundingClientRect();
                      const elRect = anchorEl.getBoundingClientRect();
                      const left =
                        elRect.left - plotRect.left + elRect.width / 2;
                      setTooltipLeftPx(left);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {hovered && tooltipLeftPx != null && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-border bg-white px-2 py-1 text-[11px] leading-tight text-gray-01 shadow-sm"
              style={{
                left: tooltipLeftPx,
                top: 8,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
              }}
              role="tooltip"
            >
              {`${hovered.hour}시 · ${hovered.totalPayAmount.toLocaleString("ko-KR")}원`}
            </div>
          )}
        </div>
      </div>

      <div
        className="mt-3 grid w-full min-w-0"
        style={{ gridTemplateColumns: plotGridTemplate }}
      >
        <div aria-hidden />
        <div
          className="flex min-w-0 justify-between gap-x-1"
          style={{
            paddingLeft: PLOT_PX_X,
            paddingRight: PLOT_PX_X,
          }}
        >
          {series.map((s) => {
            const showLabel = shouldShowHourChartAxisLabel(
              s.hour,
              axisMinHour,
              axisMaxHour,
            );
            return (
              <span
                key={`${s.hour}-axis`}
                className="min-w-0 flex-1 text-center text-[9px] leading-tight text-gray-04 tabular-nums sm:text-[10px]"
              >
                {showLabel ? formatHourLabel(s.hour) : "\u00a0"}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HourBar({
  hour,
  value,
  max,
  barMaxH,
  barClassName,
  hovered,
  onHoverChange,
}: {
  hour: number;
  value: number;
  max: number;
  barMaxH: number;
  barClassName: string;
  hovered: boolean;
  onHoverChange: (
    hour: number | null,
    anchorEl: HTMLButtonElement | null,
  ) => void;
}) {
  const rawPx = max > 0 ? (value / max) * barMaxH : 0;
  const isZero = value <= 0;
  const hPx = isZero ? 6 : Math.max(6, Math.round(rawPx));

  return (
    <button
      type="button"
      className={cn(
        "flex flex-col justify-end border-0 bg-transparent p-0",
        BAR_COL_CLASS,
        "outline-none focus-visible:ring-2 focus-visible:ring-main-04",
      )}
      onMouseEnter={(e) => onHoverChange(hour, e.currentTarget)}
      onMouseLeave={() => onHoverChange(null, null)}
      onFocus={(e) => onHoverChange(hour, e.currentTarget)}
      onBlur={() => onHoverChange(null, null)}
      aria-label={`${hour}시 매출 ${value.toLocaleString("ko-KR")}원`}
    >
      <div
        className={cn(
          BAR_FILL_ROUND,
          "w-full shrink-0 transition-opacity",
          isZero ? "bg-main-04" : barClassName,
          hovered ? "opacity-90" : "opacity-100",
        )}
        style={{ height: hPx }}
      />
    </button>
  );
}
