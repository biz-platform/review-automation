import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";
import type { AdminReferralSellerSearchData } from "@/entities/admin/types";

const querySchema = z.object({
  keyword: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? "" : String(v).trim())),
});

function sanitizeIlikePattern(raw: string): string {
  return raw.replace(/[%_,]/g, "");
}

/** GET: 어드민 — 셀러 연결용 검색(이메일·추천 코드, is_seller + 센터장|플래너만) */
async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<AdminReferralSellerSearchData>>> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const { keyword } = querySchema.parse({
    keyword: searchParams.get("keyword"),
  });

  const kw = sanitizeIlikePattern(keyword);
  if (kw.length < 2) {
    return NextResponse.json({ result: { list: [] } });
  }

  const pattern = `%${kw}%`;

  const base = () =>
    supabase
      .from("users")
      .select("id, email, role, referral_code, created_at")
      .eq("is_seller", true)
      .in("role", ["center_manager", "planner"]);

  const [{ data: byEmail, error: e1 }, { data: byRef, error: e2 }] =
    await Promise.all([
      base().ilike("email", pattern).order("created_at", { ascending: false }).limit(10),
      base()
        .ilike("referral_code", pattern)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  if (e1 || e2) {
    console.error("[admin/customers/referral-seller-search]", e1 ?? e2);
    throw e1 ?? e2;
  }

  const byId = new Map<
    string,
    {
      id: string;
      email: string | null;
      role: "center_manager" | "planner";
      referral_code: string | null;
      created_at: string;
    }
  >();
  for (const r of [...(byEmail ?? []), ...(byRef ?? [])]) {
    const row = r as {
      id: string;
      email: string | null;
      role: "center_manager" | "planner";
      referral_code: string | null;
      created_at: string;
    };
    if (!byId.has(row.id)) byId.set(row.id, row);
  }

  const rows = [...byId.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  ).slice(0, 10);

  const list = rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    referral_code:
      r.referral_code != null && String(r.referral_code).trim() !== ""
        ? String(r.referral_code).trim()
        : null,
  }));

  return NextResponse.json({ result: { list } });
}

export const GET = withRouteHandler(getHandler);
