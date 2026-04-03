import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError, AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { PHONE_MIN_LENGTH_FOR_VERIFY } from "@/lib/constants/verification";
import { toE164 } from "@/lib/services/otp/normalize-phone";
import { getOtp, consumeOtp } from "@/lib/services/otp/otp-store";
import {
  getOtpSupabase,
  consumeOtpSupabase,
} from "@/lib/services/otp/otp-store-supabase";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { shouldUseSupabaseOtp } from "@/lib/services/otp/should-use-supabase-otp";

const useSupabaseOtp = shouldUseSupabaseOtp();

/** 로컬: RPC 미적용·원격 DB에 번호 없어도 OTP만 맞으면 회원가입 검증과 동일하게 통과시키기 위한 표시용 이메일 */
const FIND_ID_DEV_FALLBACK_EMAIL =
  process.env.FIND_ID_DEV_MOCK_EMAIL?.trim() || "local-dev@find-id.oliview";

const bodySchema = z.object({
  phone: z.string().min(PHONE_MIN_LENGTH_FOR_VERIFY),
  code: z.string().length(6, "인증번호 6자리를 입력해주세요"),
});

type Result = { email: string };

async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<Result>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);
  const normalized = toE164(parsed.phone);

  const entry = useSupabaseOtp
    ? await getOtpSupabase(normalized)
    : getOtp(normalized);
  if (!entry) {
    throw new AppBadRequestError(ERROR_CODES.OTP_EXPIRED_OR_INVALID);
  }
  if (entry.code !== parsed.code.trim()) {
    throw new AppBadRequestError(ERROR_CODES.OTP_MISMATCH);
  }
  if (useSupabaseOtp) await consumeOtpSupabase(normalized);
  else consumeOtp(normalized);

  const isProd = process.env.NODE_ENV === "production";
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("get_auth_email_by_phone_e164", {
    p_phone: normalized,
  });

  let email = typeof data === "string" ? data.trim() : "";

  if (error) {
    console.error("[find-id/verify] get_auth_email_by_phone_e164", error);
    if (isProd) {
      throw new AppBadRequestError({
        code: "FIND_ID_EMAIL_LOOKUP_FAILED",
        message: "이메일을 확인하지 못했어요. 잠시 후 다시 시도해주세요.",
      });
    }
    email = "";
  }

  if (!email) {
    if (!isProd) {
      console.warn(
        "[find-id/verify] dev: RPC 결과 없음 → 폴백 이메일 반환 (회원가입과 동일하게 OTP만으로 확인)",
        { phone: normalized },
      );
      return NextResponse.json({
        result: { email: FIND_ID_DEV_FALLBACK_EMAIL },
      });
    }
    throw new AppNotFoundError({
      code: "FIND_ID_NO_EMAIL",
      message: "해당 휴대전화로 가입된 계정을 찾지 못했어요",
    });
  }

  return NextResponse.json({ result: { email } });
}

export const POST = withRouteHandler(postHandler);
