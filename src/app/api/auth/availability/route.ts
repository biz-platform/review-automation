import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { toE164 } from "@/lib/services/otp/normalize-phone";

const bodySchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().min(10).optional(),
  })
  .refine((data) => data.email ?? data.phone, {
    message: "email 또는 phone 중 하나는 필수입니다",
  });

type Result = {
  emailAvailable?: boolean;
  phoneAvailable?: boolean;
};

async function postHandler(
  request: NextRequest
): Promise<NextResponse<AppRouteHandlerResponse<Result>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);
  const supabase = createServiceRoleClient();

  const result: Result = {};

  if (parsed.email !== undefined) {
    const { data, error } = await supabase.rpc("check_auth_email_exists", {
      p_email: parsed.email.trim().toLowerCase(),
    });
    if (error) {
      console.error("[availability] check_auth_email_exists", error);
      throw new AppBadRequestError({
        code: "CHECK_AVAILABILITY_FAILED",
        message: "이메일 확인에 실패했습니다",
      });
    }
    result.emailAvailable = data === false;
  }

  if (parsed.phone !== undefined) {
    const normalized = toE164(parsed.phone);
    const { data, error } = await supabase.rpc("check_auth_phone_exists", {
      p_phone: normalized,
    });
    if (error) {
      console.error("[availability] check_auth_phone_exists", error);
      throw new AppBadRequestError({
        code: "CHECK_AVAILABILITY_FAILED",
        message: "휴대번호 확인에 실패했습니다",
      });
    }
    result.phoneAvailable = data === false;
  }

  return NextResponse.json({ result });
}

export const POST = withRouteHandler(postHandler);
