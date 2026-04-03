/**
 * 비밀번호 찾기 등: 휴대폰 OTP 검증 실패 횟수 (1시간 윈도우, 최대 5회).
 * 테이블: public.otp_phone_verify_failures (마이그레이션 053)
 */

import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  ONE_HOUR_MS,
  OTP_MAX_ATTEMPTS_PER_HOUR,
} from "@/lib/constants/verification";

const TABLE = "otp_phone_verify_failures";

function pruneTimestamps(timestamps: number[], now: number): number[] {
  const cutoff = now - ONE_HOUR_MS;
  return timestamps.filter((t) => t > cutoff);
}

export type OtpVerifyFailureLimitResult =
  | { allowed: true }
  | { allowed: false; reason: "max_per_hour" };

export async function checkOtpVerifyFailureLimitSupabase(
  phoneE164: string,
): Promise<OtpVerifyFailureLimitResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("fail_timestamps")
    .eq("identifier", phoneE164)
    .maybeSingle();

  if (error) {
    console.error("[otp-verify-failures] select", error);
    return { allowed: true };
  }

  const now = Date.now();
  const raw = (data?.fail_timestamps as number[] | null) ?? [];
  const kept = pruneTimestamps(raw, now);
  if (kept.length >= OTP_MAX_ATTEMPTS_PER_HOUR) {
    return { allowed: false, reason: "max_per_hour" };
  }
  return { allowed: true };
}

export async function recordOtpVerifyFailureSupabase(
  phoneE164: string,
): Promise<void> {
  const supabase = createServiceRoleClient();
  const now = Date.now();

  const { data: row } = await supabase
    .from(TABLE)
    .select("fail_timestamps")
    .eq("identifier", phoneE164)
    .maybeSingle();

  const prev = (row?.fail_timestamps as number[] | null) ?? [];
  const kept = pruneTimestamps(prev, now);
  const next = [...kept, now];

  await supabase.from(TABLE).upsert(
    {
      identifier: phoneE164,
      fail_timestamps: next,
    },
    { onConflict: "identifier" },
  );
}
