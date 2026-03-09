import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { getOtpEmail, consumeOtpEmail } from "@/lib/services/otp/otp-store";

const verifyEmailBodySchema = z.object({
  email: z.string().email("이메일 형식이 올바르지 않습니다"),
  code: z.string().length(6, "인증번호 6자리를 입력해주세요"),
});

async function postHandler(
  request: NextRequest
): Promise<NextResponse<AppRouteHandlerResponse<{ success: boolean }>>> {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { result: { success: false } },
      { status: 404 }
    );
  }

  const body = await request.json();
  const { email, code } = verifyEmailBodySchema.parse(body);
  const key = email.trim().toLowerCase();

  const entry = getOtpEmail(key);
  if (!entry) {
    throw new AppBadRequestError({
      code: "OTP_EXPIRED_OR_INVALID",
      message: "인증번호가 만료되었거나 올바르지 않아요. 다시 요청해주세요.",
    });
  }

  if (entry.code !== code.trim()) {
    throw new AppBadRequestError({
      code: "OTP_MISMATCH",
      message: "인증번호가 올바르지 않습니다",
    });
  }

  consumeOtpEmail(key);
  return NextResponse.json({ result: { success: true } });
}

export const POST = withRouteHandler(postHandler);
