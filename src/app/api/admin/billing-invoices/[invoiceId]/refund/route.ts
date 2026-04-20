import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";
import { assertAdminRefundTransition } from "@/lib/billing/admin-billing-refund";
import type {
  AdminBillingInvoicePaymentStatus,
  AdminBillingInvoiceRefundStatus,
} from "@/entities/admin/types";

const patchBodySchema = z.object({
  refundStatus: z.enum(["eligible", "pending", "completed"]),
});

async function patchHandler(
  request: NextRequest,
  context?: RouteContext,
) {
  const resolved = await (context?.params ?? Promise.resolve({}));
  const invoiceId = (resolved as { invoiceId?: string }).invoiceId ?? "";
  if (!invoiceId) {
    throw new AppNotFoundError({
      code: "BILLING_INVOICE_NOT_FOUND",
      message: "청구 건을 찾을 수 없습니다.",
    });
  }

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

  const body = patchBodySchema.parse(await request.json());

  const { data: row, error } = await supabase
    .from("member_billing_invoices")
    .select("id, payment_status, refund_status, paid_at")
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    throw new AppNotFoundError({
      code: "BILLING_INVOICE_NOT_FOUND",
      message: "청구 건을 찾을 수 없습니다.",
    });
  }

  const paymentStatus = row.payment_status as AdminBillingInvoicePaymentStatus;
  const storedRefund = row.refund_status as AdminBillingInvoiceRefundStatus;
  const paidAt = new Date(String(row.paid_at));

  assertAdminRefundTransition({
    storedRefundStatus: storedRefund,
    paymentStatus,
    paidAt,
    next: body.refundStatus,
    now: new Date(),
  });

  const { error: updErr } = await supabase
    .from("member_billing_invoices")
    .update({ refund_status: body.refundStatus })
    .eq("id", invoiceId);
  if (updErr) throw updErr;

  return NextResponse.json<AppRouteHandlerResponse<{ success: true }>>({
    result: { success: true },
  });
}

export const PATCH = withRouteHandler(patchHandler);
