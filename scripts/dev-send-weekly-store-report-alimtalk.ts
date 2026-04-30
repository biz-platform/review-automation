/**
 * 주간 리포트 알림톡 1회 테스트.
 * 필요: OLIVIEW_WEEKLY_REPORT_ALIMTALK_TEMPLATE_ID, CoolSMS, SEND_WEEKLY_REPORT_ALIMTALK=true(선택, 크론과 동일 플래그는 크론만 해당 — 이 스크립트는 직접 발송)
 *
 * run:
 *   pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-alimtalk.ts 01012345678
 *   pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-alimtalk.ts 01012345678 --store-id=<uuid>
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { sendWeeklyStoreReportAlimtalkIfNeeded } from "@/lib/notifications/oliview-alimtalk";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
  weeklyReportAlimtalkVariablesFromWeekEnd,
} from "@/lib/reports/weekly-store-report";
import { buildWeeklyReportPublicViewUrl } from "@/lib/reports/weekly-report-image-signature";
import { OLIVIEW_ALIMTALK_PUBLIC_WEB_URL } from "@/lib/constants/coolsms-alimtalk";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

function parseArg(name: string): string | null {
  const prefix = `--${name}=`;
  const raw = process.argv.slice(2).find((v) => v.startsWith(prefix));
  if (!raw) return null;
  return raw.slice(prefix.length).trim() || null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).map((x) => x.trim());
  const phone = argv.find((x) => x.length > 0 && !x.startsWith("--")) ?? "";
  if (!phone) {
    console.error(
      "Usage: pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-alimtalk.ts <phone> [--store-id=<uuid>]",
    );
    process.exit(1);
  }

  const storeIdArg = parseArg("store-id");
  const supabase = createServiceRoleClient();

  let storeId = storeIdArg;
  let userId = "";

  if (!storeId) {
    const { data: row, error } = await supabase
      .from("stores")
      .select("id, user_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!row?.id) {
      console.error("stores 테이블에서 테스트 매장을 찾지 못했습니다.");
      process.exit(1);
    }
    storeId = row.id;
    userId = row.user_id as string;
  } else {
    const { data: row, error } = await supabase
      .from("stores")
      .select("id, user_id")
      .eq("id", storeId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.id) {
      console.error(`store not found: ${storeId}`);
      process.exit(1);
    }
    userId = row.user_id as string;
  }

  if (!storeId) {
    process.exit(1);
  }
  const storeUuid = storeId;

  const range = previousWeekRangeFromNowKst(new Date());
  await buildWeeklyStoreReportData(supabase, {
    storeId: storeUuid,
    weekStartYmd: range.weekStartYmd,
    weekEndYmd: range.weekEndYmd,
    prevWeekStartYmd: range.prevWeekStartYmd,
    prevWeekEndYmd: range.prevWeekEndYmd,
  });

  const publicWebBase = OLIVIEW_ALIMTALK_PUBLIC_WEB_URL.replace(/\/+$/, "");
  const reportPublicViewUrl = buildWeeklyReportPublicViewUrl({
    publicBaseUrl: publicWebBase,
    storeId: storeUuid,
    weekStartYmd: range.weekStartYmd,
  });

  const alimtalkVars = weeklyReportAlimtalkVariablesFromWeekEnd(range.weekEndYmd);
  const dedupeKey = `weekly_store_report_alimtalk:dev:${storeUuid}:${Date.now()}`;

  const r = await sendWeeklyStoreReportAlimtalkIfNeeded(supabase, {
    userId,
    storeId: storeUuid,
    phone,
    dedupeKey,
    weekStartYmd: range.weekStartYmd,
    weekEndYmd: range.weekEndYmd,
    alimtalkVars,
    reportPublicViewUrl,
  });

  if (!r.sent) {
    console.error("[dev-send-weekly-store-report-alimtalk] failed", r);
    process.exit(1);
  }

  console.log("[dev-send-weekly-store-report-alimtalk] sent", {
    phone: "***" + phone.slice(-4),
    storeId: storeUuid,
    weekStartYmd: range.weekStartYmd,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
