import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import {
  checkSendLimit,
  setOtp,
  checkSendLimitEmail,
  setOtpEmail,
} from "@/lib/services/otp/otp-store";
import {
  checkSendLimitSupabase,
  setOtpSupabase,
  checkSendLimitEmailSupabase,
  setOtpEmailSupabase,
} from "@/lib/services/otp/otp-store-supabase";
import { sendVerificationCode } from "@/lib/utils/notifications/sendVerificationCode";
import { sendVerificationEmail } from "@/lib/utils/notifications/sendVerificationEmail";
import { shouldUseSupabaseOtp } from "@/lib/services/otp/should-use-supabase-otp";

const useSupabaseOtp = shouldUseSupabaseOtp();

const bodySchema = z
  .object({
    phone: z.string().min(PHONE_MIN_LENGTH_FOR_VERIFY).optional(),
    email: z.string().email().optional(),
  })
  .refine((d) => d.phone ?? d.email, {
    message: "phone 또는 email 중 하나는 필수입니다",
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

  if (parsed.phone !== undefined) {
    const normalized = toE164(parsed.phone);
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

  if (parsed.email !== undefined) {
    const key = parsed.email.trim().toLowerCase();
    const limit = useSupabaseOtp
      ? await checkSendLimitEmailSupabase(key)
      : checkSendLimitEmail(key);
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
    if (useSupabaseOtp) await setOtpEmailSupabase(key, code);
    else setOtpEmail(key, code);
    try {
      const sent = await sendVerificationEmail(key, code);
      if (!sent) throw new AppBadRequestError(ERROR_CODES.OTP_SEND_FAILED);
    } catch (e: unknown) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "OTP_EMAIL_INVALID"
      ) {
        throw new AppBadRequestError(ERROR_CODES.OTP_EMAIL_INVALID);
      }
      throw e;
    }
    const payload: Payload = { success: true };
    if (process.env.NODE_ENV !== "production") payload.devCode = code;
    return NextResponse.json({ result: payload });
  }

  throw new AppBadRequestError({
    code: "VALIDATION_ERROR",
    message: "phone 또는 email 중 하나는 필수입니다",
  });
}

export const POST = withRouteHandler(postHandler);
