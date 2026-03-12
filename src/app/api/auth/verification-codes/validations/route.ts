import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import {
  getOtp,
  consumeOtp,
  getOtpEmail,
  consumeOtpEmail,
} from "@/lib/services/otp/otp-store";

const bodySchema = z
  .object({
    phone: z.string().min(PHONE_MIN_LENGTH_FOR_VERIFY).optional(),
    email: z.string().email().optional(),
    code: z.string().length(6, "인증번호 6자리를 입력해주세요"),
  })
  .refine((d) => d.phone ?? d.email, {
    message: "phone 또는 email 중 하나는 필수입니다",
  });

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<{ success: boolean }>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);

  if (parsed.phone !== undefined) {
    const normalized = toE164(parsed.phone);
    const entry = getOtp(normalized);
    if (!entry) {
      throw new AppBadRequestError(ERROR_CODES.OTP_EXPIRED_OR_INVALID);
    }
    if (entry.code !== parsed.code.trim()) {
      throw new AppBadRequestError(ERROR_CODES.OTP_MISMATCH);
    }
    consumeOtp(normalized);
    return NextResponse.json({ result: { success: true } });
  }

  if (parsed.email !== undefined) {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ result: { success: false } }, { status: 404 });
    }
    const key = parsed.email.trim().toLowerCase();
    const entry = getOtpEmail(key);
    if (!entry) {
      throw new AppBadRequestError(ERROR_CODES.OTP_EXPIRED_OR_INVALID);
    }
    if (entry.code !== parsed.code.trim()) {
      throw new AppBadRequestError(ERROR_CODES.OTP_MISMATCH);
    }
    consumeOtpEmail(key);
    return NextResponse.json({ result: { success: true } });
  }

  throw new AppBadRequestError({
    code: "VALIDATION_ERROR",
    message: "phone 또는 email 중 하나는 필수입니다",
  });
}

export const POST = withRouteHandler(postHandler);
