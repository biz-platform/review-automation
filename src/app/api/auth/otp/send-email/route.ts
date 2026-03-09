import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import {
  checkSendLimitEmail,
  setOtpEmail,
} from "@/lib/services/otp/otp-store";

/** 로컬 전용: 실제 이메일 발송 없이 인증번호만 저장 후 devCode 반환 */
const sendEmailBodySchema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
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
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { result: { success: false } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { email } = sendEmailBodySchema.parse(body);
  const key = email.trim().toLowerCase();

  const limit = checkSendLimitEmail(key);
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
  setOtpEmail(key, code);

  return NextResponse.json({
    result: { success: true, devCode: code },
  });
}

export const POST = withRouteHandler(postHandler);
