import type { WeeklyStoreReportData } from "@/lib/reports/weekly-store-report";

function formatWon(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}

function formatPlatformName(code: WeeklyStoreReportData["platformRows"][number]["platform"]): string {
  if (code === "baemin") return "배달의민족";
  if (code === "coupang_eats") return "쿠팡이츠";
  if (code === "yogiyo") return "요기요";
  return "땡겨요";
}

export async function sendWeeklyStoreReportEmail(params: {
  toEmail: string;
  storeName: string;
  report: WeeklyStoreReportData;
  reportImageUrl?: string;
  /** 웹에서 카드 UI로 보기 (서명 URL) */
  reportViewUrl?: string;
}): Promise<boolean> {
  const shouldSend = process.env.SEND_WEEKLY_REPORT_EMAIL === "true";
  if (!shouldSend) return true;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[weekly-report] RESEND_API_KEY is not set.");
    return false;
  }

  const fromEnv = process.env.RESEND_FROM ?? "team@auth.oliview.kr";
  const from =
    fromEnv.includes("<") && fromEnv.includes(">") ? fromEnv : `올리뷰 <${fromEnv.trim()}>`;
  const reportRange = `${params.report.weekStartYmd} ~ ${params.report.weekEndYmd}`;
  const topRows = [...params.report.platformRows].sort((a, b) => b.orderCount - a.orderCount);
  const topLine = topRows
    .map((r) => `${formatPlatformName(r.platform)} ${r.orderCount.toLocaleString("ko-KR")}건`)
    .join(" · ");

  const imageTag = params.reportImageUrl
    ? `<img src="${params.reportImageUrl}" alt="주간 리포트" style="width:286px;border-radius:10px;display:block;" />`
    : "";
  const viewLink =
    params.reportViewUrl && params.reportViewUrl.length > 0
      ? `<p><a href="${params.reportViewUrl}" target="_blank" rel="noopener noreferrer">웹에서 리포트 보기</a></p>`
      : "";

  const html = [
    `<h2>${params.report.weekLabel}</h2>`,
    `<p><strong>${params.storeName}</strong> 매장 주간 리포트 (${reportRange})</p>`,
    `<p>지난 주 매출: <strong>${formatWon(params.report.totalSalesAmount)}</strong></p>`,
    `<p>전주 대비: <strong>${params.report.salesDeltaPercent >= 0 ? "+" : ""}${params.report.salesDeltaPercent}%</strong></p>`,
    `<p>플랫폼 주문 현황: ${topLine}</p>`,
    viewLink,
    imageTag,
  ].join("\n");

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: params.toEmail.trim().toLowerCase(),
      subject: `[올리뷰] ${params.storeName} ${params.report.weekLabel}`,
      html,
      text: [
        `${params.report.weekLabel}`,
        `${params.storeName} 매장 주간 리포트 (${reportRange})`,
        `지난 주 매출: ${formatWon(params.report.totalSalesAmount)}`,
        `전주 대비: ${params.report.salesDeltaPercent >= 0 ? "+" : ""}${params.report.salesDeltaPercent}%`,
        `플랫폼 주문 현황: ${topLine}`,
        params.reportViewUrl ? `웹 리포트: ${params.reportViewUrl}` : "",
        params.reportImageUrl ? `리포트 이미지: ${params.reportImageUrl}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
    if (result.error) {
      console.error("[weekly-report] resend error", result.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[weekly-report] email send failed", error);
    return false;
  }
}
