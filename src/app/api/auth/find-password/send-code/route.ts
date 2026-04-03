import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { checkSendLimit, setOtp } from "@/lib/services/otp/otp-store";
import {
  checkSendLimitSupabase,
  setOtpSupabase,
} from "@/lib/services/otp/otp-store-supabase";
import { sendVerificationCode } from "@/lib/utils/notifications/sendVerificationCode";
import { shouldUseSupabaseOtp } from "@/lib/services/otp/should-use-supabase-otp";
import { createServiceRoleClient } from "@/lib/db/supabase-server";

const useSupabaseOtp = shouldUseSupabaseOtp();

const bodySchema = z.object({
  email: z.string().email(),
  phone: z.string().min(PHONE_MIN_LENGTH_FOR_VERIFY),
});

function generateSixDigitCode(): string {
  return Math.random().toString().slice(2, 8);
}

type Payload = { success: boolean; devCode?: string };

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<Payload>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);
  const email = parsed.email.trim().toLowerCase();
  const normalized = toE164(parsed.phone);

  const supabase = createServiceRoleClient();
  const { data: matches, error: rpcError } = await supabase.rpc(
    "check_auth_phone_matches_email",
    { p_email: email, p_phone: normalized },
  );

  if (rpcError) {
    console.error("[find-password/send-code] check_auth_phone_matches_email", rpcError);
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_CHECK_FAILED);
  }
  if (matches !== true) {
    throw new AppBadRequestError(ERROR_CODES.FIND_PASSWORD_PHONE_EMAIL_MISMATCH);
  }

  const limit = useSupabaseOtp
    ? await checkSendLimitSupabase(normalized)
    : checkSendLimit(normalized);
  if (!limit.allowed) {
    if (limit.reason === "cooldown") {
      throw new AppBadRequestError({
        ...ERROR_CODES.OTP_COOLDOWN,
        detail: `retryAfterSec: ${limit.retryAfterSec}`,
      });
    }
    throw new AppBadRequestError(ERROR_CODES.OTP_MAX_PER_HOUR);
  }

  const code = generateSixDigitCode();
  if (useSupabaseOtp) await setOtpSupabase(normalized, code);
  else setOtp(normalized, code);

  const sent = await sendVerificationCode(normalized, code);
  if (!sent) throw new AppBadRequestError(ERROR_CODES.OTP_SEND_FAILED);

  const payload: Payload = { success: true };
  if (process.env.NODE_ENV !== "production") payload.devCode = code;
  return NextResponse.json({ result: payload });
}

export const POST = withRouteHandler(postHandler);
