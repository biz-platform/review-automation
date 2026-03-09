import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { getOtp, consumeOtp } from "@/lib/services/otp/otp-store";

const verifyBodySchema = z.object({
  phone: z.string().min(10, "휴대번호를 입력해주세요"),
  code: z.string().length(6, "인증번호 6자리를 입력해주세요"),
});

async function postHandler(
  request: NextRequest
): Promise<NextResponse<AppRouteHandlerResponse<{ success: boolean }>>> {
  const body = await request.json();
  const { phone, code } = verifyBodySchema.parse(body);
  const normalized = toE164(phone);

  const entry = getOtp(normalized);
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

  consumeOtp(normalized);
  return NextResponse.json({ result: { success: true } });
}

export const POST = withRouteHandler(postHandler);
