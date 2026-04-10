import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";

const MARKETING_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://oliview.kr";

const REFERRAL_CODE_LENGTH = 8;

function generateReferralCode(): string {
  return randomBytes(REFERRAL_CODE_LENGTH)
    .toString("base64url")
    .replace(/[-_]/g, (c) => (c === "-" ? "x" : "X"))
    .slice(0, REFERRAL_CODE_LENGTH);
}

/** GET: 셀러 전용 영업(마케팅) 링크. is_seller인 경우만 반환. 링크는 oliview.kr/?ref=짧은코드 */
async function getHandler(
  _request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<{ link: string }>>> {
  const { user, supabase: authSupabase } = await getUser(_request);
  await requireMemberManageSubscriptionAccess(authSupabase, user.id);
  const supabase = createServiceRoleClient();
  const { data: row } = await supabase
    .from("users")
    .select("is_seller, referral_code")
    .eq("id", user.id)
    .maybeSingle();

  if (!row?.is_seller) {
    throw new AppForbiddenError({
      code: "SELLER_REQUIRED",
      message: "셀러 권한이 필요합니다.",
    });
  }

  let code = (row.referral_code as string) ?? null;
  if (!code) {
    for (let i = 0; i < 5; i++) {
      code = generateReferralCode();
      const { error } = await supabase
        .from("users")
        .update({
          referral_code: code,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
      if (!error) break;
      if ((error as { code?: string }).code !== "23505") throw error;
    }
    if (!code) {
      const { data: existing } = await supabase
        .from("users")
        .select("referral_code")
        .eq("id", user.id)
        .maybeSingle();
      code = (existing?.referral_code as string) ?? generateReferralCode();
    }
  }

  const base = MARKETING_BASE_URL.replace(/\/$/, "");
  const link = `${base}/?ref=${encodeURIComponent(code)}`;

  return NextResponse.json({ result: { link } });
}

export const GET = withRouteHandler(getHandler);
