import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { PASSWORD_RECOVERY_SESSION_MINUTES } from "@/lib/constants/find-password";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { getOtp, consumeOtp } from "@/lib/services/otp/otp-store";
import {
  getOtpSupabase,
  consumeOtpSupabase,
} from "@/lib/services/otp/otp-store-supabase";
import { shouldUseSupabaseOtp } from "@/lib/services/otp/should-use-supabase-otp";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  checkOtpVerifyFailureLimitSupabase,
  recordOtpVerifyFailureSupabase,
} from "@/lib/services/otp/otp-verify-failures-supabase";

const useSupabaseOtp = shouldUseSupabaseOtp();

const bodySchema = z.object({
  email: z.string().email(),
  phone: z.string().min(PHONE_MIN_LENGTH_FOR_VERIFY),
  code: z.string().length(6, "인증번호 6자리를 입력해주세요"),
});

type Result = { recoverySessionId: string };

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<Result>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);
  const email = parsed.email.trim().toLowerCase();
  const normalized = toE164(parsed.phone);

  const limit = await checkOtpVerifyFailureLimitSupabase(normalized);
  if (!limit.allowed) {
    throw new AppBadRequestError(ERROR_CODES.OTP_VERIFY_MAX_PER_HOUR);
  }

  const entry = useSupabaseOtp
    ? await getOtpSupabase(normalized)
    : getOtp(normalized);
  if (!entry) {
    throw new AppBadRequestError(ERROR_CODES.OTP_EXPIRED_OR_INVALID);
  }
  if (entry.code !== parsed.code.trim()) {
    await recordOtpVerifyFailureSupabase(normalized);
    throw new AppBadRequestError(ERROR_CODES.OTP_MISMATCH);
  }
  if (useSupabaseOtp) await consumeOtpSupabase(normalized);
  else consumeOtp(normalized);

  const supabase = createServiceRoleClient();
  const { data: matches, error: matchErr } = await supabase.rpc(
    "check_auth_phone_matches_email",
    { p_email: email, p_phone: normalized },
  );
  if (matchErr) {
    console.error("[find-password/verify-otp] check_auth_phone_matches_email", matchErr);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_CHECK_FAILED);
  }
  if (matches !== true) {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_PHONE_EMAIL_MISMATCH);
  }

  const { data: userId, error: userErr } = await supabase.rpc(
    "get_auth_user_id_for_password_recovery",
    { p_email: email, p_phone: normalized },
  );
  if (userErr) {
    console.error("[find-password/verify-otp] get_auth_user_id_for_password_recovery", userErr);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_CHECK_FAILED);
  }
  if (!userId || typeof userId !== "string") {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_PHONE_EMAIL_MISMATCH);
  }

  const expiresAt = new Date(
    Date.now() + PASSWORD_RECOVERY_SESSION_MINUTES * 60 * 1000,
  );
  const { data: row, error: insertErr } = await supabase
    .from("password_recovery_sessions")
    .insert({
      user_id: userId,
      email_normalized: email,
      phone_e164: normalized,
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  if (insertErr || !row?.id) {
    console.error("[find-password/verify-otp] insert session", insertErr);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_CHECK_FAILED);
  }

  return NextResponse.json({
    result: { recoverySessionId: row.id as string },
  });
}

export const POST = withRouteHandler(postHandler);
