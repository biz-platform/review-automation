"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

export type SalesHourTrendPoint = {
  hour: number;
  /** 원 */
  totalPayAmount: number;
};

const PLOT_H_PX = 150;
const BAR_W_PX = 22;
const BAR_ROUND = "rounded-lg";
const Y_AXIS_LABEL_W_PX = 56;
const PLOT_PX_X = 4; // px-1

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
  /** 막대 높이 스케일 = 플롯 높이와 동일 (시간 축 라벨은 플롯 밖에 있음) */
  const barMaxH = PLOT_H_PX;

  const plotRef = useRef<HTMLDivElement | null>(null);

  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [tooltipLeftPx, setTooltipLeftPx] = useState<number | null>(null);
  const hovered = useMemo(() => {
    if (hoveredHour == null) return null;
    const point = series.find((s) => s.hour === hoveredHour) ?? null;
    return point;
  }, [hoveredHour, series]);

  const yTicks = useMemo(() => {
    const t = [max, Math.round((max * 2) / 3), Math.round(max / 3), 0];
    // 중복 제거(값이 작을 때)
    return [...new Set(t)].sort((a, b) => b - a);
  }, [max]);

  return (
    <div className={cn("w-full", className)}>
      <div
        className="relative isolate w-full"
        style={{ height: PLOT_H_PX, paddingLeft: Y_AXIS_LABEL_W_PX }}
      >
        {/* 가로 눈금 (값 스케일과 동일) */}
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

        {/* Y축 기준 금액 — 각 가로선과 같은 높이, 플롯 왼쪽 끝(축 열) */}
        <div
          className="pointer-events-none absolute left-0 top-0 z-2"
          style={{ width: Y_AXIS_LABEL_W_PX, height: PLOT_H_PX }}
          aria-hidden
        >
          {yTicks.map((t) => (
            <span
              key={`tick-${t}`}
              className="absolute left-0 right-0 pr-2 text-[10px] leading-none text-gray-03 tabular-nums"
              style={{
                top: `${(1 - t / max) * 100}%`,
                transform: "translateY(-50%)",
              }}
            >
              {t === 0 ? "0" : `${formatWonCompact(t)}원`}
            </span>
          ))}
        </div>

        <div
          ref={plotRef}
          className="relative z-1 flex w-full items-end justify-between"
          style={{ paddingLeft: PLOT_PX_X, paddingRight: PLOT_PX_X }}
        >
          {series.map((s) => (
            <div key={s.hour} className="flex min-w-0 flex-1 justify-center">
              <div
                className="flex items-end justify-center"
                style={{ width: BAR_W_PX }}
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
                    const left = elRect.left - plotRect.left + elRect.width / 2;
                    setTooltipLeftPx(left);
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Hover tooltip */}
        {hovered && tooltipLeftPx != null && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-white px-2 py-1 text-[11px] leading-tight text-gray-01 shadow-sm"
            style={{
              left: Y_AXIS_LABEL_W_PX + tooltipLeftPx,
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

      <div
        className="mt-3 flex w-full flex-wrap justify-between gap-x-1 gap-y-1"
        style={{
          paddingLeft: Y_AXIS_LABEL_W_PX + PLOT_PX_X,
          paddingRight: PLOT_PX_X,
        }}
      >
        {series.map((s) => (
          <span
            key={`${s.hour}-axis`}
            className="min-w-0 flex-1 text-center text-gray-04 text-[10px] leading-tight tabular-nums"
          >
            {formatHourLabel(s.hour)}
          </span>
        ))}
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
  // 0원 시간대도 축 위치가 보이도록 최소 높이 바를 표시한다.
  const isZero = value <= 0;
  const hPx = isZero ? 6 : Math.max(6, Math.round(rawPx));

  return (
    <button
      type="button"
      className="flex h-[150px] shrink-0 flex-col justify-end gap-1"
      onMouseEnter={(e) => onHoverChange(hour, e.currentTarget)}
      onMouseLeave={(e) => onHoverChange(null, e.currentTarget)}
      onFocus={(e) => onHoverChange(hour, e.currentTarget)}
      onBlur={(e) => onHoverChange(null, e.currentTarget)}
      aria-label={`${hour}시 매출 ${value.toLocaleString("ko-KR")}원`}
    >
      <div
        className={cn(
          BAR_ROUND,
          "w-full shrink-0 transition-opacity",
          isZero ? "bg-main-04" : barClassName,
          hovered ? "opacity-90" : "opacity-100",
        )}
        style={{ width: BAR_W_PX, height: hPx }}
      />
    </button>
  );
}
