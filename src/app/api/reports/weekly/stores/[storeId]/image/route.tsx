import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
  type WeeklyStoreReportData,
} from "@/lib/reports/weekly-store-report";
import { verifyWeeklyReportImageSignature } from "@/lib/reports/weekly-report-image-signature";
import { addCalendarDaysKst } from "@/lib/utils/kst-date";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatPlatformName(code: WeeklyStoreReportData["platformRows"][number]["platform"]): string {
  if (code === "baemin") return "배달의민족";
  if (code === "coupang_eats") return "쿠팡이츠";
  if (code === "yogiyo") return "요기요";
  return "땡겨요";
}

function maxValue(nums: number[]): number {
  return Math.max(1, ...nums);
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await context.params;
  const weekStartQ = request.nextUrl.searchParams.get("weekStart");
  const ts = request.nextUrl.searchParams.get("ts") ?? "";
  const sig = request.nextUrl.searchParams.get("sig") ?? "";
  const now = new Date();

  const defaultRange = previousWeekRangeFromNowKst(now);
  const weekStartYmd = weekStartQ?.trim() || defaultRange.weekStartYmd;
  if (!verifyWeeklyReportImageSignature({ storeId, weekStartYmd, ts, sig })) {
    return new Response("Unauthorized", { status: 401 });
  }
  const weekEndYmd = addCalendarDaysKst(weekStartYmd, 6);
  const prevWeekStartYmd = addCalendarDaysKst(weekStartYmd, -7);
  const prevWeekEndYmd = addCalendarDaysKst(weekEndYmd, -7);

  const supabase = createServiceRoleClient();
  const report = await buildWeeklyStoreReportData(supabase, {
    storeId,
    weekStartYmd,
    weekEndYmd,
    prevWeekStartYmd,
    prevWeekEndYmd,
  });

  const barMax = maxValue(report.weekdayBars.map((d) => d.amount));
  const hourBarMax = maxValue(report.hourBars.map((d) => d.amount));
  const peakHourSet = new Set(report.hourHighlightIndices);
  const m = report.timeSlotShares;
  const peakSlotShare = Math.max(m.morningPercent, m.lunchPercent, m.dinnerPercent);
  const topPlatforms = [...report.platformRows].sort((a, b) => b.orderCount - a.orderCount);
  const popularDaySet = new Set(report.weekdayPopularIndices);
  const WEEKDAY_KO = ["월", "화", "수", "목", "금", "토", "일"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "286px",
          height: "1536px",
          background: "#F5F5F5",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Pretendard, Arial, sans-serif",
          color: "#1A1A1A",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700 }}>{report.weekLabel}</div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#8A8A8A" }}>
          매장별 리포트는 원래 대시보드에서 확인할 수 있어요
        </div>

        <div style={{ marginTop: 26, fontSize: 34, fontWeight: 700, lineHeight: 1.22 }}>
          지난 주 매출은
          <br />
          {formatWon(report.totalSalesAmount)}이었어요
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: "#8A8A8A" }}>
          전주 대비{" "}
          <span style={{ color: report.salesDeltaPercent >= 0 ? "#D64545" : "#2D7FF9" }}>
            {report.salesDeltaPercent >= 0 ? "▲ +" : "▼ "}
            {Math.abs(report.salesDeltaPercent)}%
          </span>
        </div>

        <div style={{ marginTop: 22, fontSize: 20, fontWeight: 600 }}>요일별 추이</div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "flex-end" }}>
          {report.weekdayBars.map((d, idx) => {
            const h = Math.max(8, Math.round((d.amount / barMax) * 96));
            const isPopular = popularDaySet.has(idx);
            const isChill = report.weekdayChillIndex === idx && !isPopular;
            const barBg = isPopular ? "#7ED321" : isChill ? "#FFD644" : "#D9D9D9";
            return (
              <div
                key={`day-bar-${d.day}`}
                style={{ width: 28, display: "flex", flexDirection: "column", alignItems: "center" }}
              >
                <div style={{ height: 18, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                  {isPopular ? (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        padding: "2px 5px",
                        borderRadius: 999,
                        background: "#E8F5D9",
                        color: "#4A8A12",
                      }}
                    >
                      인기
                    </span>
                  ) : isChill ? (
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 600,
                        padding: "2px 5px",
                        borderRadius: 999,
                        background: "#FFF6D6",
                        color: "#B8860B",
                      }}
                    >
                      여유
                    </span>
                  ) : null}
                </div>
                <div style={{ fontSize: 10, color: "#6F6F6F", marginTop: 4 }}>{d.day}</div>
                <div style={{ fontSize: 9, color: "#8A8A8A", marginTop: 2 }}>{WEEKDAY_KO[idx] ?? ""}</div>
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    height: 100,
                  }}
                >
                  <div
                    style={{
                      width: 18,
                      height: h,
                      borderTopLeftRadius: 4,
                      borderTopRightRadius: 4,
                      background: barBg,
                    }}
                  />
                </div>
                <div style={{ fontSize: 8, color: "#8A8A8A", marginTop: 6, textAlign: "center" }}>
                  {d.amount <= 0 ? "없음" : Math.round(d.amount).toLocaleString("ko-KR")}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 26, fontSize: 20, fontWeight: 600 }}>시간별 추이</div>
        <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
          {[
            {
              label: "아침 시간대",
              value: m.morningPercent,
              on: peakSlotShare > 0 && m.morningPercent === peakSlotShare,
            },
            {
              label: "점심 시간대",
              value: m.lunchPercent,
              on: peakSlotShare > 0 && m.lunchPercent === peakSlotShare,
            },
            {
              label: "저녁 시간대",
              value: m.dinnerPercent,
              on: peakSlotShare > 0 && m.dinnerPercent === peakSlotShare,
            },
          ].map((slot) => (
            <div
              key={slot.label}
              style={{
                flex: 1,
                borderRadius: 8,
                border: "1px solid #E5E5E5",
                background: slot.on ? "#EEF6E8" : "#FFFFFF",
                padding: "10px 6px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 10, color: "#8A8A8A" }}>{slot.label}</div>
              <div style={{ marginTop: 3, fontSize: 20, fontWeight: 600 }}>{slot.value}%</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 3, alignItems: "flex-end", height: 82 }}>
          {report.hourBars.map((d, idx) => {
            const h = Math.max(4, Math.round((d.amount / hourBarMax) * 64));
            const green = peakHourSet.has(idx);
            return (
              <div key={`hour-${d.hour}-${idx}`} style={{ width: 12, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div
                  style={{
                    width: 7,
                    height: h,
                    borderTopLeftRadius: 3,
                    borderTopRightRadius: 3,
                    background: green ? "#7ED321" : "#D9D9D9",
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 26, fontSize: 30, lineHeight: 1.2, fontWeight: 700 }}>
          {formatPlatformName(topPlatforms[0]?.platform ?? "baemin")} 주문이 다른 플랫폼보다
          <br />
          하루 평균 {report.topPlatformDailyOrderGap}건 더 많았어요
        </div>

        <div style={{ marginTop: 20, fontSize: 20, fontWeight: 600 }}>플랫폼별 주문 현황</div>
        <div style={{ marginTop: 10, border: "1px solid #EAEAEA", borderRadius: 8, overflow: "hidden", background: "#FFF" }}>
          <div style={{ padding: "10px 10px 8px" }}>
            <div style={{ display: "flex", height: 10, borderRadius: 999, overflow: "hidden" }}>
              {report.platformRows.map((p, idx) => {
                const pct = report.platformOrderPercents[idx] ?? 0;
                const color =
                  p.platform === "baemin"
                    ? "#11B8B6"
                    : p.platform === "coupang_eats"
                      ? "#2D7FF9"
                      : p.platform === "yogiyo"
                        ? "#FF6A00"
                        : "#F4C430";
                return (
                  <div key={`bar-${p.platform}`} style={{ width: `${pct}%`, minWidth: 0, background: color }} />
                );
              })}
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 9, fontWeight: 600, color: "#4A7C59", textAlign: "center" }}>
              {report.platformRows.map((p, idx) => {
                const pct = report.platformOrderPercents[idx] ?? 0;
                return (
                  <div key={`pct-${p.platform}`} style={{ width: `${pct}%`, minWidth: 0 }}>
                    {pct > 0 ? `${pct}%` : ""}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 11 }}>
            {report.platformRows.map((p) => (
              <div key={`row-${p.platform}`} style={{ display: "flex", borderTop: "1px solid #EAEAEA" }}>
                <div style={{ width: 120, padding: "8px 10px" }}>{formatPlatformName(p.platform)}</div>
                <div style={{ width: 70, padding: "8px 10px", borderLeft: "1px solid #EAEAEA" }}>
                  {p.orderCount.toLocaleString("ko-KR")}건
                </div>
                <div style={{ flex: 1, padding: "8px 10px", borderLeft: "1px solid #EAEAEA" }}>
                  {formatWon(p.salesAmount)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { width: 286, height: 1536 },
  );
}
