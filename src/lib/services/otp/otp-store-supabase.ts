/**
 * 프로덕션용 OTP 저장소. Supabase 공유 테이블 사용.
 * 서버리스 다중 인스턴스에서 발송·검증이 동일한 데이터를 참조하도록 함.
 */

import { createServiceRoleClient } from "@/lib/db/supabase-server";
import type { OtpEntry } from "@/lib/services/otp/otp-store";
import type { SendLimitResult } from "@/lib/services/otp/otp-store";
import {
  OTP_CODE_VALIDITY_MS,
  OTP_COOLDOWN_MS,
  OTP_MAX_ATTEMPTS_PER_HOUR,
  ONE_HOUR_MS,
  OTP_EMAIL_KEY_PREFIX,
} from "@/lib/constants/verification";

const TABLE = "verification_otp";

function emailKey(email: string): string {
  return OTP_EMAIL_KEY_PREFIX + email.trim().toLowerCase();
}

export async function setOtpSupabase(phone: string, code: string): Promise<void> {
  const now = Date.now();
  const expiresAt = new Date(now + OTP_CODE_VALIDITY_MS).toISOString();
  const lastSentAt = new Date(now).toISOString();
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from(TABLE)
    .select("sent_timestamps")
    .eq("identifier", phone)
    .single();
  const prev = (row?.sent_timestamps as number[] | null) ?? [];
  const cutoff = now - ONE_HOUR_MS;
  const sentTimestamps = [...prev.filter((t: number) => t > cutoff), now];
  await supabase.from(TABLE).upsert(
    {
      identifier: phone,
      code,
      expires_at: expiresAt,
      last_sent_at: lastSentAt,
      sent_timestamps: sentTimestamps,
    },
    { onConflict: "identifier" }
  );
}

export async function getOtpSupabase(phone: string): Promise<OtpEntry | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from(TABLE)
    .select("code, expires_at")
    .eq("identifier", phone)
    .single();
  if (!data?.code) return null;
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt) return null;
  return { code: data.code, expiresAt, createdAt: expiresAt - OTP_CODE_VALIDITY_MS };
}

export async function consumeOtpSupabase(phone: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).delete().eq("identifier", phone);
  return !error;
}

export async function checkSendLimitSupabase(phone: string): Promise<SendLimitResult> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from(TABLE)
    .select("last_sent_at, sent_timestamps")
    .eq("identifier", phone)
    .single();
  const now = Date.now();
  const lastSentAt = data?.last_sent_at ? new Date(data.last_sent_at).getTime() : null;
  if (lastSentAt != null && now - lastSentAt < OTP_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((OTP_COOLDOWN_MS - (now - lastSentAt)) / 1000),
    };
  }
  const timestamps = (data?.sent_timestamps as number[] | null) ?? [];
  const cutoff = now - ONE_HOUR_MS;
  const count = timestamps.filter((t: number) => t > cutoff).length;
  if (count >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, reason: "max_per_hour" };
  }
  return { allowed: true };
}

// --- Email ---

export async function setOtpEmailSupabase(email: string, code: string): Promise<void> {
  const key = emailKey(email);
  const now = Date.now();
  const expiresAt = new Date(now + OTP_CODE_VALIDITY_MS).toISOString();
  const lastSentAt = new Date(now).toISOString();
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from(TABLE)
    .select("sent_timestamps")
    .eq("identifier", key)
    .single();
  const prev = (row?.sent_timestamps as number[] | null) ?? [];
  const cutoff = now - ONE_HOUR_MS;
  const sentTimestamps = [...prev.filter((t: number) => t > cutoff), now];
  await supabase.from(TABLE).upsert(
    {
      identifier: key,
      code,
      expires_at: expiresAt,
      last_sent_at: lastSentAt,
      sent_timestamps: sentTimestamps,
    },
    { onConflict: "identifier" }
  );
}

export async function getOtpEmailSupabase(email: string): Promise<OtpEntry | null> {
  const key = emailKey(email);
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from(TABLE)
    .select("code, expires_at")
    .eq("identifier", key)
    .single();
  if (!data?.code) return null;
  const expiresAt = new Date(data.expires_at).getTime();
  if (Date.now() > expiresAt) return null;
  return { code: data.code, expiresAt, createdAt: expiresAt - OTP_CODE_VALIDITY_MS };
}

export async function consumeOtpEmailSupabase(email: string): Promise<boolean> {
  const key = emailKey(email);
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from(TABLE).delete().eq("identifier", key);
  return !error;
}

export async function checkSendLimitEmailSupabase(email: string): Promise<SendLimitResult> {
  const key = emailKey(email);
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from(TABLE)
    .select("last_sent_at, sent_timestamps")
    .eq("identifier", key)
    .single();
  const now = Date.now();
  const lastSentAt = data?.last_sent_at ? new Date(data.last_sent_at).getTime() : null;
  if (lastSentAt != null && now - lastSentAt < OTP_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterSec: Math.ceil((OTP_COOLDOWN_MS - (now - lastSentAt)) / 1000),
    };
  }
  const timestamps = (data?.sent_timestamps as number[] | null) ?? [];
  const cutoff = now - ONE_HOUR_MS;
  const count = timestamps.filter((t: number) => t > cutoff).length;
  if (count >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, reason: "max_per_hour" };
  }
  return { allowed: true };
}
