"use client";

import { cn } from "@/lib/utils/cn";

/** 직전 동일 기간 대비 증감률(%). `deltaPercent`는 API에서 이미 반올림된 값. */
export function GlancePercentDeltaLine({
  deltaPercent,
  compact = false,
}: {
  deltaPercent: number;
  compact?: boolean;
}) {
  const rounded = Math.round(deltaPercent * 10) / 10;
  const same = rounded === 0;
  const up = rounded > 0;
  if (same) {
    return (
      <p className="typo-body-03-regular text-gray-03">지난 기간과 동일</p>
    );
  }
  const abs = Math.abs(rounded).toLocaleString("ko-KR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  const sign = up ? "+" : "−";
  const arrow = up ? "▲" : "▼";

  if (compact) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1 typo-body-02-regular tabular-nums",
          up ? "text-red-500" : "text-blue-600",
        )}
      >
        <span aria-hidden>{arrow}</span>
        <span>
          {sign}
          {abs}%
        </span>
      </p>
    );
  }
  return (
    <p
      className={cn(
        "typo-body-03-regular",
        up ? "text-red-500" : "text-blue-600",
      )}
    >
      {arrow} 지난 기간보다 {sign}
      {abs}%
    </p>
  );
}

export function GlancePointsDeltaLine({
  delta,
  suffix,
  compact = false,
}: {
  delta: number;
  suffix: string;
  compact?: boolean;
}) {
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
  if (compact) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1 typo-body-02-regular tabular-nums",
          up ? "text-red-500" : "text-blue-600",
        )}
      >
        <span aria-hidden>{arrow}</span>
        <span>
          {sign}
          {abs}
          {suffix}
        </span>
      </p>
    );
  }
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
