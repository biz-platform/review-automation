import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { createSnsSupabaseClient } from "@/lib/db/supabase-sns";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { AppBadRequestError } from "@/lib/errors/app-error";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";

/** 전화번호를 숫자만 남겨 비교 (하이픈 포함 입력 가능) */
function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

const applyBodySchema = z
  .object({
    dbtalk_id: z.string().min(1, "디비톡 ID를 입력해 주세요."),
    name: z.string().min(1, "이름을 입력해 주세요."),
    phone: z
      .string()
      .min(1, "전화번호를 입력해 주세요.")
      .transform((s) => phoneDigitsOnly(s.trim())),
  })
  .refine((data) => data.phone.length >= 10, {
    message: "올바른 휴대전화 번호를 입력해 주세요.",
    path: ["phone"],
  });

type ApplyBody = z.infer<typeof applyBodySchema>;

/** POST: SNS dbtalk_partners에서 센터장 인증 후 review DB users.is_seller = true, role = center_manager 로 전환 (센터장인 경우에만) */
async function postHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<{ success: true }>>> {
  const body = (await request.json()) as unknown;
  const parsed = applyBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new AppBadRequestError({
      code: "VALIDATION_ERROR",
      message: parsed.error.errors.map((e) => e.message).join(" "),
      detail: parsed.error.message,
    });
  }
  const { dbtalk_id, name, phone } = parsed.data as ApplyBody;
  const normalizedPhone = phone;

  const { user } = await getUser(request);

  const sns = createSnsSupabaseClient();
  const { data: candidates, error: snsError } = await sns
    .from("dbtalk_partners")
    .select("id, phone, role_label")
    .eq("dbtalk_id", dbtalk_id.trim())
    .eq("name", name.trim())
    .limit(10);

  if (snsError) {
    console.error("[sellers/apply] SNS dbtalk_partners query error", snsError);
    throw new AppBadRequestError({
      code: "SNS_VERIFY_FAILED",
      message: "센터장 인증 확인 중 오류가 발생했습니다.",
      detail: snsError.message,
    });
  }

  const partner = (candidates ?? []).find(
    (row) => phoneDigitsOnly((row.phone ?? "").trim()) === normalizedPhone,
  );

  console.log("[sellers/apply] SNS dbtalk_partners OK", {
    dbtalk_id: dbtalk_id.trim(),
    candidates_count: candidates?.length ?? 0,
    matched: !!partner,
    role_label: partner?.role_label ?? null,
  });

  if (!partner) {
    throw new AppBadRequestError({
      code: "CENTER_MANAGER_NOT_FOUND",
      message:
        "입력하신 정보와 일치하는 센터장이 없습니다. 디비톡 ID, 이름, 전화번호를 확인해 주세요.",
    });
  }

  if ((partner.role_label ?? "").trim() === "플래너") {
    throw new AppBadRequestError({
      code: "PLANNER_NOT_ELIGIBLE",
      message:
        "센터장 혹은 판매 권한을 얻은 플래너만 셀러 등록이 가능합니다. 고객센터로 문의해 주세요.",
    });
  }

  if ((partner.role_label ?? "").trim() !== "센터장") {
    throw new AppBadRequestError({
      code: "CENTER_MANAGER_NOT_FOUND",
      message:
        "입력하신 정보와 일치하는 센터장이 없습니다. 디비톡 ID, 이름, 전화번호를 확인해 주세요.",
    });
  }

  const reviewSupabase = createServiceRoleClient();
  const { data: existingUser } = await reviewSupabase
    .from("users")
    .select("id")
    .eq("dbtalk_partner_id", partner.id)
    .limit(1)
    .maybeSingle();

  if (existingUser && existingUser.id !== user.id) {
    throw new AppBadRequestError({
      code: "DBTALK_ALREADY_USED",
      message:
        "이미 다른 계정에서 인증에 사용된 정보입니다. 고객센터로 문의해 주세요.",
    });
  }

  const { error: updateError } = await reviewSupabase
    .from("users")
    .update({
      is_seller: true,
      role: "center_manager",
      dbtalk_partner_id: partner.id,
      dbtalk_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[sellers/apply] users update error", updateError);
    throw new AppBadRequestError({
      code: "SELLER_UPDATE_FAILED",
      message: "셀러 전환 처리 중 오류가 발생했습니다.",
      detail: updateError.message,
    });
  }

  return NextResponse.json({ result: { success: true } });
}

export const POST = withRouteHandler(postHandler);
