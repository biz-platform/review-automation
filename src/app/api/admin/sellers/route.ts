import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createSnsSupabaseClient } from "@/lib/db/supabase-sns";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";
import type { AdminSellerListData, AdminSellerRow } from "@/entities/admin/types";

const getQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  keyword: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? "" : String(v).trim())),
  sellerType: z
    .enum(["all", "center_manager", "planner"])
    .optional()
    .default("all"),
});

type UserRow = {
  id: string;
  email: string | null;
  role: "center_manager" | "planner";
  dbtalk_partner_id: number | null;
  referral_code: string | null;
  created_at: string;
};

type PartnerRow = {
  id: number;
  name: string;
  phone: string;
};

function sanitizeIlikePattern(raw: string): string {
  return raw.replace(/[%_,]/g, "");
}

/** GET: 어드민 셀러 목록 (role=센터장|플래너). 이름·휴대폰은 SNS(dbtalk_partners), 이메일·추천인 코드는 올리뷰 users */
async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<AdminSellerListData>>> {
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
  const q = getQuerySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    keyword: searchParams.get("keyword") ?? undefined,
    sellerType: searchParams.get("sellerType") ?? undefined,
  });

  const kw = sanitizeIlikePattern(q.keyword);
  let filterUserIds: string[] | null = null;

  if (kw.length > 0) {
    const pattern = `%${kw}%`;
    const sns = createSnsSupabaseClient();

    const [
      { data: emailHits },
      { data: refHits },
      { data: byName },
      { data: byPhone },
      { data: byDbtalk },
    ] = await Promise.all([
      supabase
        .from("users")
        .select("id")
        .in("role", ["center_manager", "planner"])
        .ilike("email", pattern),
      supabase
        .from("users")
        .select("id")
        .in("role", ["center_manager", "planner"])
        .ilike("referral_code", pattern),
      sns.from("dbtalk_partners").select("id").ilike("name", pattern).limit(400),
      sns.from("dbtalk_partners").select("id").ilike("phone", pattern).limit(400),
      sns.from("dbtalk_partners").select("id").ilike("dbtalk_id", pattern).limit(400),
    ]);

    const byEmail = new Set([
      ...(emailHits ?? []).map((r: { id: string }) => r.id),
      ...(refHits ?? []).map((r: { id: string }) => r.id),
    ]);
    const partnerIdSet = new Set<number>();
    for (const arr of [byName, byPhone, byDbtalk]) {
      for (const row of arr ?? []) {
        partnerIdSet.add((row as { id: number }).id);
      }
    }
    const partnerIds = [...partnerIdSet];

    if (partnerIds.length > 0) {
      const { data: byPartner } = await supabase
        .from("users")
        .select("id")
        .in("role", ["center_manager", "planner"])
        .in("dbtalk_partner_id", partnerIds);
      (byPartner ?? []).forEach((r: { id: string }) => byEmail.add(r.id));
    }

    filterUserIds = Array.from(byEmail);
    if (filterUserIds.length === 0) {
      return NextResponse.json({ result: { list: [], count: 0 } });
    }
  }

  let listQuery = supabase
    .from("users")
    .select("id, email, role, dbtalk_partner_id, referral_code, created_at", {
      count: "exact",
    })
    .in("role", ["center_manager", "planner"]);

  if (q.sellerType !== "all") {
    listQuery = listQuery.eq("role", q.sellerType);
  }

  if (filterUserIds) {
    listQuery = listQuery.in("id", filterUserIds);
  }

  const { data: rows, error, count } = await listQuery
    .order("created_at", { ascending: false })
    .range(q.offset, q.offset + q.limit - 1);

  if (error) {
    console.error("[admin/sellers] list error", error);
    throw error;
  }

  const userRows = (rows ?? []) as UserRow[];
  const partnerIdSet = new Set<number>();
  for (const r of userRows) {
    if (r.dbtalk_partner_id != null) partnerIdSet.add(r.dbtalk_partner_id);
  }

  const partnerById = new Map<number, PartnerRow>();
  if (partnerIdSet.size > 0) {
    const sns = createSnsSupabaseClient();
    const { data: partners, error: pErr } = await sns
      .from("dbtalk_partners")
      .select("id, name, phone")
      .in("id", [...partnerIdSet]);

    if (pErr) {
      console.error("[admin/sellers] dbtalk_partners batch error", pErr);
      throw pErr;
    }
    for (const p of partners ?? []) {
      const row = p as PartnerRow;
      partnerById.set(row.id, row);
    }
  }

  const sellerIds = userRows.map((r) => r.id);
  const lastOrderBySeller = new Map<string, string | null>();
  const referralCountBySeller = new Map<string, number>();
  for (const id of sellerIds) {
    lastOrderBySeller.set(id, null);
    referralCountBySeller.set(id, 0);
  }

  if (sellerIds.length > 0) {
    const { data: refPaidRows, error: refErr } = await supabase
      .from("users")
      .select("referred_by_user_id, paid_at")
      .in("referred_by_user_id", sellerIds);

    if (refErr) {
      console.error("[admin/sellers] referred aggregate error", refErr);
      throw refErr;
    }

    for (const row of refPaidRows ?? []) {
      const sid = row.referred_by_user_id as string | null;
      if (sid == null) continue;
      referralCountBySeller.set(sid, (referralCountBySeller.get(sid) ?? 0) + 1);
      const paid = row.paid_at as string | null;
      if (paid == null) continue;
      const cur = lastOrderBySeller.get(sid);
      if (cur == null || paid > cur) lastOrderBySeller.set(sid, paid);
    }
  }

  const list: AdminSellerRow[] = userRows.map((r) => {
    const p =
      r.dbtalk_partner_id != null ? partnerById.get(r.dbtalk_partner_id) : undefined;
    return {
      id: r.id,
      email: r.email,
      dbtalkName: p?.name ?? null,
      dbtalkPhone: p?.phone ?? null,
      referralCode:
        r.referral_code != null && String(r.referral_code).trim() !== ""
          ? String(r.referral_code).trim()
          : null,
      role: r.role,
      createdAt: r.created_at,
      paymentCount: 0,
      estimatedSettlementAmount: 0,
      lastOrderAt: lastOrderBySeller.get(r.id) ?? null,
      referralCustomerCount: referralCountBySeller.get(r.id) ?? 0,
    };
  });

  return NextResponse.json({
    result: { list, count: count ?? 0 },
  });
}

export const GET = withRouteHandler(getHandler);
