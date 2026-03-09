import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import {
  checkSendLimit,
  setOtp,
  type SendLimitResult,
} from "@/lib/services/otp/otp-store";
import { sendVerificationCode } from "@/lib/utils/notifications/sendVerificationCode";

const sendBodySchema = z.object({
  phone: z.string().min(10, "휴대번호를 입력해주세요"),
});

function generateSixDigitCode(): string {
  return Math.random().toString().slice(2, 8);
}

async function postHandler(
  request: NextRequest
): Promise<
  NextResponse<
    AppRouteHandlerResponse<{ success: boolean; devCode?: string }>
  >
> {
  const body = await request.json();
  const { phone } = sendBodySchema.parse(body);
  const normalized = toE164(phone);

  const limit = checkSendLimit(normalized);
  if (!limit.allowed) {
    if (limit.reason === "cooldown") {
      throw new AppBadRequestError({
        code: "OTP_COOLDOWN",
        message: "잠시 후 다시 요청해주세요",
        detail: `retryAfterSec: ${limit.retryAfterSec}`,
      });
    }
    throw new AppBadRequestError({
      code: "OTP_MAX_PER_HOUR",
      message: "인증번호는 1시간에 최대 3번까지 발송할 수 있어요",
    });
  }

  const code = generateSixDigitCode();
  setOtp(normalized, code);

  const sent = await sendVerificationCode(normalized, code);
  if (!sent) {
    throw new AppBadRequestError({
      code: "OTP_SEND_FAILED",
      message: "인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.",
    });
  }

  const payload: { success: boolean; devCode?: string } = { success: true };
  if (process.env.NODE_ENV !== "production") {
    payload.devCode = code;
  }
  return NextResponse.json({ result: payload });
}

export const POST = withRouteHandler(postHandler);
