/**
 * 주간 리포트 이메일 1회 테스트 발송.
 *
 * run:
 *   pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-email.ts bizplatformofficial@gmail.com
 *   pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-email.ts bizplatformofficial@gmail.com --store-id=<uuid>
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
} from "@/lib/reports/weekly-store-report";
import {
  buildWeeklyReportImageUrl,
  buildWeeklyReportPublicViewUrl,
} from "@/lib/reports/weekly-report-image-signature";
import { sendWeeklyStoreReportEmail } from "@/lib/utils/notifications/sendWeeklyStoreReportEmail";

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
  const toEmail = argv.find((x) => x.length > 0 && !x.startsWith("--")) ?? "";
  if (!toEmail) {
    console.error(
      "Usage: pnpm exec tsx --no-cache scripts/dev-send-weekly-store-report-email.ts <email> [--store-id=<uuid>]",
    );
    process.exit(1);
  }

  const storeIdArg = parseArg("store-id");
  const supabase = createServiceRoleClient();

  let storeId = storeIdArg;
  let storeName = "매장";

  if (!storeId) {
    const { data: row, error } = await supabase
      .from("stores")
      .select("id, name")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!row?.id) {
      console.error("stores 테이블에서 테스트 매장을 찾지 못했습니다.");
      process.exit(1);
    }
    storeId = row.id;
    storeName = (row.name as string | null) ?? "매장";
  } else {
    const { data: row, error } = await supabase
      .from("stores")
      .select("id, name")
      .eq("id", storeId)
      .maybeSingle();
    if (error) throw error;
    if (!row?.id) {
      console.error(`store not found: ${storeId}`);
      process.exit(1);
    }
    storeName = (row.name as string | null) ?? "매장";
  }

  if (!storeId) {
    process.exit(1);
  }
  const storeUuid = storeId;

  const range = previousWeekRangeFromNowKst(new Date());
  const report = await buildWeeklyStoreReportData(supabase, {
    storeId: storeUuid,
    weekStartYmd: range.weekStartYmd,
    weekEndYmd: range.weekEndYmd,
    prevWeekStartYmd: range.prevWeekStartYmd,
    prevWeekEndYmd: range.prevWeekEndYmd,
  });

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_BASE_URL?.trim() || "";
  const reportImageUrl =
    baseUrl.length > 0
      ? buildWeeklyReportImageUrl({
          publicBaseUrl: baseUrl,
          storeId: storeUuid,
          weekStartYmd: range.weekStartYmd,
        })
      : undefined;
  const reportViewUrl =
    baseUrl.length > 0
      ? buildWeeklyReportPublicViewUrl({
          publicBaseUrl: baseUrl,
          storeId: storeUuid,
          weekStartYmd: range.weekStartYmd,
        })
      : undefined;

  const ok = await sendWeeklyStoreReportEmail({
    toEmail,
    storeName,
    report,
    reportImageUrl,
    reportViewUrl,
  });
  if (!ok) {
    console.error("[dev-send-weekly-store-report-email] failed");
    process.exit(1);
  }

  console.log("[dev-send-weekly-store-report-email] sent", {
    toEmail,
    storeId: storeUuid,
    storeName,
    weekStartYmd: range.weekStartYmd,
    weekEndYmd: range.weekEndYmd,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
