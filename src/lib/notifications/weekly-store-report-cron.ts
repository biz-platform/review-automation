import type { SupabaseClient } from "@supabase/supabase-js";
import { ENV_KEY } from "@/lib/config/env-keys";
import { OLIVIEW_ALIMTALK_PUBLIC_WEB_URL } from "@/lib/constants/coolsms-alimtalk";
import {
  markNotificationEventError,
  markNotificationEventSent,
  tryCreateNotificationEvent,
} from "@/lib/notifications/notification-events";
import { sendWeeklyStoreReportAlimtalkIfNeeded } from "@/lib/notifications/oliview-alimtalk";
import {
  buildWeeklyStoreReportData,
  previousWeekRangeFromNowKst,
  weeklyReportAlimtalkVariablesFromWeekEnd,
} from "@/lib/reports/weekly-store-report";
import {
  buildWeeklyReportImageUrl,
  buildWeeklyReportPublicViewUrl,
} from "@/lib/reports/weekly-report-image-signature";
import { sendWeeklyStoreReportEmail } from "@/lib/utils/notifications/sendWeeklyStoreReportEmail";

type StoreRow = {
  id: string;
  name: string | null;
  user_id: string;
};

type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
};

function nonEmpty(s: unknown): string | null {
  return typeof s === "string" && s.trim() ? s.trim() : null;
}

function shouldSendWeeklyReportEmail(): boolean {
  return process.env.SEND_WEEKLY_REPORT_EMAIL === "true";
}

function shouldSendWeeklyReportAlimtalk(): boolean {
  return process.env[ENV_KEY.SEND_WEEKLY_REPORT_ALIMTALK] === "true";
}

function weeklyReportAlimtalkTemplateConfigured(): boolean {
  const id = (
    process.env[ENV_KEY.OLIVIEW_WEEKLY_REPORT_ALIMTALK_TEMPLATE_ID] ?? ""
  ).trim();
  return id.length > 0;
}

export async function runWeeklyStoreReportCron(
  supabase: SupabaseClient,
  now: Date = new Date(),
): Promise<{
  storesChecked: number;
  emailsSent: number;
  skippedNoEmail: number;
  emailDeduped: number;
  emailFailed: number;
  alimtalkSent: number;
  skippedAlimtalkOff: number;
  skippedAlimtalkNoTemplate: number;
  skippedNoPhone: number;
  alimtalkDeduped: number;
  alimtalkFailed: number;
  weekStartYmd: string;
  weekEndYmd: string;
}> {
  const { weekStartYmd, weekEndYmd, prevWeekStartYmd, prevWeekEndYmd } =
    previousWeekRangeFromNowKst(now);

  const { data: stores, error: storesErr } = await supabase
    .from("stores")
    .select("id, name, user_id");
  if (storesErr) throw storesErr;
  const storeRows = (stores ?? []) as StoreRow[];

  const userIds = [...new Set(storeRows.map((s) => s.user_id))];
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, email, phone")
    .in("id", userIds);
  if (usersErr) throw usersErr;
  const userMap = new Map<string, UserRow>();
  for (const user of (users ?? []) as UserRow[]) userMap.set(user.id, user);

  let emailsSent = 0;
  let skippedNoEmail = 0;
  let emailDeduped = 0;
  let emailFailed = 0;

  let alimtalkSent = 0;
  let skippedAlimtalkOff = 0;
  let skippedAlimtalkNoTemplate = 0;
  let skippedNoPhone = 0;
  let alimtalkDeduped = 0;
  let alimtalkFailed = 0;

  const templateReady = weeklyReportAlimtalkTemplateConfigured();
  const publicWebBase = OLIVIEW_ALIMTALK_PUBLIC_WEB_URL.replace(/\/+$/, "");

  for (const store of storeRows) {
    const user = userMap.get(store.user_id);
    const email = nonEmpty(user?.email);
    const phone = nonEmpty(user?.phone);

    const report = await buildWeeklyStoreReportData(supabase, {
      storeId: store.id,
      weekStartYmd,
      weekEndYmd,
      prevWeekStartYmd,
      prevWeekEndYmd,
    });

    const appBase =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
      "";
    const reportImageUrlForEmail =
      appBase.length > 0
        ? buildWeeklyReportImageUrl({
            publicBaseUrl: appBase,
            storeId: store.id,
            weekStartYmd,
          })
        : undefined;
    const reportViewUrlForEmail =
      appBase.length > 0
        ? buildWeeklyReportPublicViewUrl({
            publicBaseUrl: appBase,
            storeId: store.id,
            weekStartYmd,
          })
        : undefined;

    const reportPublicViewUrlForAlimtalk = buildWeeklyReportPublicViewUrl({
      publicBaseUrl: publicWebBase,
      storeId: store.id,
      weekStartYmd,
    });

    if (shouldSendWeeklyReportEmail()) {
      if (!email) {
        skippedNoEmail += 1;
      } else {
        const dedupeKey = `weekly_store_report:${store.id}:${weekStartYmd}:${email}`;
        const evt = await tryCreateNotificationEvent(supabase, {
          dedupeKey,
          eventType: "weekly_store_report",
          userId: store.user_id,
          storeId: store.id,
          meta: { weekStartYmd, weekEndYmd, channel: "email", email },
        });
        if (!evt.created || !evt.id) {
          emailDeduped += 1;
        } else {
          try {
            const ok = await sendWeeklyStoreReportEmail({
              toEmail: email,
              storeName: nonEmpty(store.name) ?? "매장",
              report,
              reportImageUrl: reportImageUrlForEmail,
              reportViewUrl: reportViewUrlForEmail,
            });
            if (!ok) {
              emailFailed += 1;
              await markNotificationEventError(
                supabase,
                evt.id,
                "weekly_report_email_send_failed",
              );
            } else {
              await markNotificationEventSent(supabase, evt.id);
              emailsSent += 1;
            }
          } catch (error) {
            emailFailed += 1;
            await markNotificationEventError(
              supabase,
              evt.id,
              error instanceof Error ? error.message : "weekly_report_unknown_error",
            );
          }
        }
      }
    }

    if (!shouldSendWeeklyReportAlimtalk()) {
      skippedAlimtalkOff += 1;
    } else if (!templateReady) {
      skippedAlimtalkNoTemplate += 1;
    } else if (!phone) {
      skippedNoPhone += 1;
    } else {
      const alimtalkVars = weeklyReportAlimtalkVariablesFromWeekEnd(weekEndYmd);
      const dedupeKey = `weekly_store_report_alimtalk:${store.id}:${weekStartYmd}:${phone}`;
      const r = await sendWeeklyStoreReportAlimtalkIfNeeded(supabase, {
        userId: store.user_id,
        storeId: store.id,
        phone,
        dedupeKey,
        weekStartYmd,
        weekEndYmd,
        alimtalkVars,
        reportPublicViewUrl: reportPublicViewUrlForAlimtalk,
      });
      if (r.reason === "deduped") alimtalkDeduped += 1;
      else if (r.sent) alimtalkSent += 1;
      else alimtalkFailed += 1;
    }
  }

  return {
    storesChecked: storeRows.length,
    emailsSent,
    skippedNoEmail,
    emailDeduped,
    emailFailed,
    alimtalkSent,
    skippedAlimtalkOff,
    skippedAlimtalkNoTemplate,
    skippedNoPhone,
    alimtalkDeduped,
    alimtalkFailed,
    weekStartYmd,
    weekEndYmd,
  };
}
