import {
  formatPreviousWeekComparisonLabel,
  type WeeklyStoreReportData,
} from "@/lib/reports/weekly-store-report";
import { shouldShowHourChartAxisLabel } from "@/lib/utils/hour-chart-axis";

/**
 * Figma: U-06 대시보드 > P-01_한 눈에 요약 (node 1140:1668)
 * 색·타이포는 올리뷰 DESIGN-SYSTEM / globals typo-* 와 맞춤.
 */
const PLATFORM_META: Record<
  WeeklyStoreReportData["platformRows"][number]["platform"],
  { label: string; color: string }
> = {
  baemin: { label: "배달의민족", color: "#00A8A6" },
  coupang_eats: { label: "쿠팡이츠", color: "#0074F3" },
  yogiyo: { label: "요기요", color: "#F64800" },
  ddangyo: { label: "땡겨요", color: "#FFCF37" },
};

const TOK = {
  gray01: "#242424",
  gray02: "#434343",
  gray03: "#555555",
  gray05: "#8B8B8B",
  gray07: "#DFDFDF",
  gray08: "#F9F9F9",
  caption: "#4C555C",
  red01: "#DF1D1D",
  blueUp: "#0074F3",
  main01: "#57AE00",
  main03: "#82DC28",
  main05: "#F5FAE6",
  chillBg: "#FFEDB9",
  chillText: "#FF9200",
  hourAxis: "#81868A",
  pctGreen: "#28D800",
} as const;

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];

export type WeeklyStoreReportCardProps = {
  data: WeeklyStoreReportData;
  /** 인기/여유 배지: `above-date`(기본)=날짜 숫자 위, `above-bar`=날짜 아래·막대 바로 위 */
  weekdayBadgePlacement?: "above-bar" | "above-date";
};

function DeltaArrow({ up }: { up: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
      {up ? (
        <path
          d="M7 3.5 11.5 8H8.75v3.5h-3.5V8H2.5L7 3.5Z"
          fill="currentColor"
        />
      ) : (
        <path
          d="M7 10.5 2.5 6H5.25V2.5h3.5V6h2.75L7 10.5Z"
          fill="currentColor"
        />
      )}
    </svg>
  );
}

function cumulativePercentStops(percents: readonly number[]): number[] {
  const out: number[] = [0];
  let acc = 0;
  for (const p of percents) {
    acc += p;
    out.push(acc);
  }
  return out;
}

function PlatformStackedBar({
  rows,
  percents,
}: {
  rows: WeeklyStoreReportData["platformRows"];
  percents: readonly number[];
}) {
  const tickXs = cumulativePercentStops(percents);
  const uniqueTicks = [
    ...new Set(tickXs.map((x) => Math.min(100, Math.max(0, x)))),
  ].sort((a, b) => a - b);

  return (
    <>
      <div className="flex h-2.5 w-full gap-0.5">
        {rows.map((row, idx) => {
          const p = percents[idx] ?? 0;
          return (
            <div
              key={`seg-${row.platform}`}
              className="min-h-0 min-w-0 rounded-sm"
              style={{
                flexGrow: Math.max(0, p),
                flexBasis: 0,
                flexShrink: 1,
                backgroundColor: PLATFORM_META[row.platform].color,
              }}
            />
          );
        })}
      </div>

      <div className="relative mt-2 h-5 w-full">
        {uniqueTicks.map((x) => {
          const atStart = x <= 0;
          const atEnd = x >= 100;
          return (
            <div
              key={`tick-${x}`}
              className="absolute bottom-px w-px"
              style={{
                left: atStart ? "0%" : atEnd ? "100%" : `${x}%`,
                height: "10px",
                transform: atStart
                  ? "none"
                  : atEnd
                    ? "translateX(-100%)"
                    : "translateX(-50%)",
                backgroundColor: TOK.pctGreen,
              }}
              aria-hidden
            />
          );
        })}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ backgroundColor: TOK.pctGreen }}
        />
      </div>

      <div
        className="mt-1 flex w-full gap-0.5 text-left text-[8px] font-medium leading-[12px]"
        style={{ color: TOK.pctGreen }}
      >
        {rows.map((row, idx) => {
          const pct = percents[idx] ?? 0;
          return (
            <div
              key={`pct-${row.platform}`}
              className="min-w-0 text-center"
              style={{
                flexGrow: Math.max(0, pct),
                flexBasis: 0,
                flexShrink: 1,
              }}
            >
              {pct > 0 ? `${pct}%` : ""}
            </div>
          );
        })}
      </div>
    </>
  );
}

function KpiChip({
  label,
  value,
  highlighted = false,
}: {
  label: string;
  value: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className="typo-body-03-regular flex min-h-0 min-w-0 flex-col gap-1 rounded-lg border px-4 py-4 text-center"
      style={{
        borderColor: TOK.gray07,
        backgroundColor: highlighted ? TOK.main05 : "#FFFFFF",
        color: TOK.gray05,
      }}
    >
      <p className="whitespace-nowrap">{label}</p>
      <p className="typo-body-02-bold" style={{ color: TOK.gray02 }}>
        {value}
      </p>
    </div>
  );
}

export function WeeklyStoreReportCard({
  data,
  weekdayBadgePlacement = "above-date",
}: WeeklyStoreReportCardProps) {
  const maxDay = Math.max(1, ...data.weekdayBars.map((d) => d.amount));
  const popularDays = new Set(data.weekdayPopularIndices);

  const maxHour =
    data.hourBars.length > 0
      ? Math.max(1, ...data.hourBars.map((h) => h.amount))
      : 1;
  const hourAxisMin =
    data.hourBars.length > 0
      ? Math.min(...data.hourBars.map((p) => Number(p.hour)))
      : 0;
  const hourAxisMax =
    data.hourBars.length > 0
      ? Math.max(...data.hourBars.map((p) => Number(p.hour)))
      : 0;

  const sortedPlatforms = [...data.platformRows].sort(
    (a, b) => b.orderCount - a.orderCount,
  );
  const topPlatform = sortedPlatforms[0];
  const topPlatformLabel = topPlatform
    ? PLATFORM_META[topPlatform.platform].label
    : "—";

  const peakHourSet = new Set(data.hourHighlightIndices);
  const { morningPercent, lunchPercent, dinnerPercent } = data.timeSlotShares;
  const peakSlotShare = Math.max(morningPercent, lunchPercent, dinnerPercent);

  const WEEKDAY_PLOT_PX = 110;
  const HOUR_PLOT_PX = 84;

  const comparisonLabel = formatPreviousWeekComparisonLabel(data.weekStartYmd);
  const deltaUp = data.salesDeltaPercent >= 0;
  const deltaOne = (Math.round(data.salesDeltaPercent * 10) / 10).toFixed(1);

  return (
    <section className="mx-auto w-[360px] overflow-hidden bg-white">
      <header
        className="px-4 pb-5 pt-10"
        style={{ backgroundColor: TOK.gray08, minHeight: "112px" }}
      >
        <h2 className="typo-heading-01-bold" style={{ color: TOK.gray01 }}>
          {data.weekLabel}
        </h2>
        <p className="typo-body-03-regular mt-2" style={{ color: TOK.caption }}>
          매장별 리포트는 올리뷰 대시보드에서 확인할 수 있어요
        </p>
      </header>

      <div className="space-y-7 px-4 pb-8 pt-10">
        <section>
          <h3 className="typo-heading-02-regular" style={{ color: TOK.gray01 }}>
            지난 주 매출은
            <br />
            {formatWon(data.totalSalesAmount)}이었어요
          </h3>
          <p
            className="typo-body-03-regular mt-2 flex flex-wrap items-center gap-1"
            style={{ color: TOK.gray03 }}
          >
            <span>{comparisonLabel}</span>
            <span
              className="inline-flex shrink-0"
              style={{ color: deltaUp ? TOK.red01 : TOK.blueUp }}
            >
              <DeltaArrow up={deltaUp} />
            </span>
            <span
              className="font-medium"
              style={{ color: deltaUp ? TOK.red01 : TOK.blueUp }}
            >
              {deltaUp ? "+" : ""}
              {deltaOne}%
            </span>
          </p>
        </section>

        <section>
          <h4 className="typo-body-01-bold" style={{ color: TOK.gray02 }}>
            요일별 추이
          </h4>
          <div className="mt-4">
            <div className="grid grid-cols-7 gap-2">
              {data.weekdayBars.map((point, idx) => {
                const barPx = Math.max(
                  4,
                  Math.round((point.amount / maxDay) * WEEKDAY_PLOT_PX),
                );
                const isPopular = popularDays.has(idx);
                const isChill = data.weekdayChillIndex === idx && !isPopular;
                const barColor = isPopular
                  ? TOK.main03
                  : isChill
                    ? "#FFCF37"
                    : TOK.gray07;
                const badgeRow = (
                  <div className="flex min-h-[14px] w-full items-end justify-center">
                    {isPopular ? (
                      <span
                        className="rounded-lg px-[5px] pb-0.5 pt-[3px] text-[8px] font-medium leading-[10px] tracking-tight"
                        style={{
                          backgroundColor: TOK.main05,
                          color: TOK.main01,
                        }}
                      >
                        인기
                      </span>
                    ) : isChill ? (
                      <span
                        className="rounded-lg px-[5px] pb-0.5 pt-[3px] text-[8px] font-medium leading-[10px] tracking-tight"
                        style={{
                          backgroundColor: TOK.chillBg,
                          color: TOK.chillText,
                        }}
                      >
                        여유
                      </span>
                    ) : null}
                  </div>
                );
                const dateRow = (
                  <span
                    className="typo-body-03-bold"
                    style={{ color: TOK.gray03 }}
                  >
                    {point.day}
                  </span>
                );
                return (
                  <div
                    key={`weekday-col-${point.day}-${idx}`}
                    className="flex min-w-0 flex-col items-center text-center"
                  >
                    {weekdayBadgePlacement === "above-date" ? (
                      <>
                        {badgeRow}
                        <div className="mt-0.5">{dateRow}</div>
                      </>
                    ) : (
                      <>
                        {dateRow}
                        <div className="mt-0.5">{badgeRow}</div>
                      </>
                    )}
                    <div className="mt-0.5 flex h-[110px] w-full items-end justify-center">
                      <div
                        className="w-6 shrink-0 rounded-t-[2px]"
                        style={{
                          height: barPx,
                          minHeight: 4,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                    <span
                      className="typo-body-03-regular mt-1 w-full"
                      style={{ color: TOK.gray05 }}
                    >
                      {WEEKDAY_KO[idx] ?? "—"}
                    </span>
                    <span
                      className="mt-1 w-full text-[8px] font-normal leading-[10px]"
                      style={{ color: TOK.gray03 }}
                    >
                      {point.amount <= 0
                        ? "없음"
                        : formatInt(Math.round(point.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
            <div
              className="mt-3 h-px w-full"
              style={{ backgroundColor: TOK.gray07 }}
              aria-hidden
            />
          </div>
        </section>

        <section>
          <h4 className="typo-body-01-bold" style={{ color: TOK.gray02 }}>
            시간별 추이
          </h4>
          <div className="mt-4 grid min-w-0 grid-cols-3 gap-2">
            <KpiChip
              label="아침 시간대"
              value={`${morningPercent}%`}
              highlighted={
                peakSlotShare > 0 && morningPercent === peakSlotShare
              }
            />
            <KpiChip
              label="점심 시간대"
              value={`${lunchPercent}%`}
              highlighted={peakSlotShare > 0 && lunchPercent === peakSlotShare}
            />
            <KpiChip
              label="저녁 시간대"
              value={`${dinnerPercent}%`}
              highlighted={peakSlotShare > 0 && dinnerPercent === peakSlotShare}
            />
          </div>
          <div className="mt-4">
            {data.hourBars.length === 0 ? (
              <p
                className="rounded-lg border border-dashed px-3 py-6 text-center text-[13px] font-normal leading-[17px]"
                style={{ borderColor: TOK.gray07, color: TOK.gray05 }}
              >
                해당 주에 주문이 있는 시간대 데이터가 없어요.
              </p>
            ) : (
              <>
                <div
                  className="grid gap-1"
                  style={{
                    gridTemplateColumns: `repeat(${data.hourBars.length}, minmax(0, 1fr))`,
                  }}
                >
                  {data.hourBars.map((point, index) => {
                    const barPx = Math.max(
                      3,
                      Math.round((point.amount / maxHour) * HOUR_PLOT_PX),
                    );
                    const isPeakHour = peakHourSet.has(index);
                    return (
                      <div
                        key={`hour-bar-${index}`}
                        className="flex h-[84px] items-end justify-center"
                      >
                        <div
                          className="w-[7px] shrink-0 rounded-t-[2px]"
                          style={{
                            height: barPx,
                            minHeight: 3,
                            backgroundColor: isPeakHour ? TOK.main03 : TOK.gray07,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div
                  className="mt-2 grid text-center text-[13px] font-normal leading-[17px] tracking-tight"
                  style={{
                    color: TOK.hourAxis,
                    gridTemplateColumns: `repeat(${data.hourBars.length}, minmax(0, 1fr))`,
                  }}
                >
                  {data.hourBars.map((point, index) => {
                    const h = Number(point.hour);
                    const show = shouldShowHourChartAxisLabel(
                      h,
                      hourAxisMin,
                      hourAxisMax,
                    );
                    return (
                      <span key={`hour-lbl-${index}`}>
                        {show ? point.hour : "\u00a0"}
                      </span>
                    );
                  })}
                </div>
              </>
            )}
            <div
              className="mt-3 h-px w-full"
              style={{ backgroundColor: TOK.gray07 }}
              aria-hidden
            />
          </div>
        </section>

        <section>
          <h3 className="typo-heading-02-regular" style={{ color: TOK.gray01 }}>
            {topPlatformLabel} 주문이 다른 플랫폼보다
            <br />
            하루 평균 {data.topPlatformDailyOrderGap}건 더 많았어요
          </h3>
        </section>

        <section>
          <h4 className="typo-body-01-bold" style={{ color: TOK.gray02 }}>
            플랫폼별 주문 현황
          </h4>
          <div
            className="mt-4 overflow-hidden rounded-lg border bg-white"
            style={{ borderColor: TOK.gray07 }}
          >
            <div className="px-3 py-3">
              <PlatformStackedBar
                rows={data.platformRows}
                percents={data.platformOrderPercents}
              />
            </div>

            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="typo-body-03-bold" style={{ color: TOK.gray01 }}>
                  <th
                    className="border px-3 py-2 font-medium"
                    style={{ borderColor: TOK.gray07 }}
                  >
                    배달 플랫폼
                  </th>
                  <th
                    className="border px-3 py-2 font-medium"
                    style={{ borderColor: TOK.gray07 }}
                  >
                    주문 수
                  </th>
                  <th
                    className="border px-3 py-2 font-medium"
                    style={{ borderColor: TOK.gray07 }}
                  >
                    매출
                  </th>
                </tr>
              </thead>
              <tbody
                className="typo-body-03-regular"
                style={{ color: TOK.gray02 }}
              >
                {data.platformRows.map((row) => (
                  <tr key={row.platform}>
                    <td
                      className="border px-3 py-2"
                      style={{ borderColor: TOK.gray07 }}
                    >
                      <span
                        className="mr-2 inline-block h-3.5 w-3.5 rounded-[2px]"
                        style={{
                          backgroundColor: PLATFORM_META[row.platform].color,
                        }}
                      />
                      {PLATFORM_META[row.platform].label}
                    </td>
                    <td
                      className="border px-3 py-2"
                      style={{ borderColor: TOK.gray07 }}
                    >
                      {formatInt(row.orderCount)}건
                    </td>
                    <td
                      className="border px-3 py-2"
                      style={{ borderColor: TOK.gray07 }}
                    >
                      {formatWon(row.salesAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
