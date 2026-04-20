import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type { AdminBillingInvoiceListData } from "@/entities/admin/types";
import { AppForbiddenError } from "@/lib/errors/app-error";
import { loadAdminBillingInvoices } from "@/lib/billing/load-admin-billing-invoices";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  memberType: z
    .enum(["all", "center_manager", "planner", "paid_member", "free_member"])
    .optional()
    .default("all"),
  keyword: z.string().optional().default(""),
  invoiceCode: z.string().optional().default(""),
  month: z.string().optional().default(""),
});

function isPgUndefinedTable(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42P01"
  );
}

async function getHandler(request: NextRequest) {
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
  const q = querySchema.parse({
    limit: searchParams.get("limit"),
    offset: searchParams.get("offset"),
    memberType: searchParams.get("memberType") ?? undefined,
    keyword: searchParams.get("keyword") ?? undefined,
    invoiceCode: searchParams.get("invoiceCode") ?? undefined,
    month: searchParams.get("month") ?? undefined,
  });

  let result: AdminBillingInvoiceListData;
  try {
    result = await loadAdminBillingInvoices(supabase, {
      limit: q.limit,
      offset: q.offset,
      memberType: q.memberType,
      keyword: q.keyword,
      invoiceCode: q.invoiceCode,
      month: q.month,
    });
  } catch (e) {
    if (isPgUndefinedTable(e)) {
      result = { list: [], count: 0 };
    } else {
      throw e;
    }
  }

  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result,
  });
}

export const GET = withRouteHandler(getHandler);
