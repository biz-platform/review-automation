import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { toE164 } from "@/lib/services/otp/normalize-phone";

const bodySchema = z.object({
  email: z.string().email("올바른 이메일 형식을 입력해주세요"),
  phone: z.string().min(10, "휴대번호를 입력해주세요"),
  password: z
    .string()
    .min(8, "비밀번호는 8자 이상이어야 합니다")
    .max(20, "비밀번호는 20자 이하여야 합니다")
    .regex(
      /^(?=.*[A-Za-z])(?=.*\d)[\x20-\x7E]{8,20}$/,
      "8~20자, 영문과 숫자를 조합해 입력해주세요"
    ),
});

type Result = { userId: string };

async function postHandler(
  request: NextRequest
): Promise<NextResponse<AppRouteHandlerResponse<Result>>> {
  const body = await request.json();
  const parsed = bodySchema.parse(body);

  const email = parsed.email.trim().toLowerCase();
  const phoneE164 = toE164(parsed.phone.replace(/\D/g, ""));
  const supabase = createServiceRoleClient();

  const { data: existingEmail } = await supabase.rpc("check_auth_email_exists", {
    p_email: email,
  });
  if (existingEmail === true) {
    throw new AppBadRequestError({
      code: "EMAIL_ALREADY_EXISTS",
      message: "이미 가입된 이메일입니다",
    });
  }

  const { data: existingPhone } = await supabase.rpc("check_auth_phone_exists", {
    p_phone: phoneE164,
  });
  if (existingPhone === true) {
    throw new AppBadRequestError({
      code: "PHONE_ALREADY_EXISTS",
      message: "이미 가입된 휴대전화 번호입니다",
    });
  }

  const {
    data: { user },
    error: createError,
  } = await supabase.auth.admin.createUser({
    email,
    password: parsed.password,
    email_confirm: true,
  });

  if (createError) {
    console.error("[signup] createUser", createError);
    throw new AppBadRequestError({
      code: "SIGNUP_FAILED",
      message: createError.message ?? "회원가입에 실패했습니다",
    });
  }

  if (!user?.id) {
    throw new AppBadRequestError({
      code: "SIGNUP_FAILED",
      message: "회원가입에 실패했습니다",
    });
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { phone: phoneE164 }
  );
  if (updateError) {
    console.warn("[signup] updateUserById phone", updateError);
  }

  const { error: insertError } = await supabase.from("users").insert({
    id: user.id,
    email,
    phone: phoneE164,
  });

  if (insertError) {
    console.error("[signup] public.users insert", insertError);
    throw new AppBadRequestError({
      code: "SIGNUP_FAILED",
      message: "프로필 저장에 실패했습니다. 잠시 후 다시 시도해주세요.",
    });
  }

  return NextResponse.json({ result: { userId: user.id } }, { status: 201 });
}

export const POST = withRouteHandler(postHandler);
