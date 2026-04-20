import { AppBadRequestError } from "@/lib/errors/app-error";
import type { AdminBillingInvoiceRefundStatus } from "@/entities/admin/types";
import { isWithinPaidRefundCalendarWindow } from "@/lib/billing/refund-window";

export type AdminRefundPatchStatus = "eligible" | "pending" | "completed";

export function assertAdminRefundTransition(params: {
  storedRefundStatus: AdminBillingInvoiceRefundStatus;
  paymentStatus: "completed" | "error";
  paidAt: Date;
  next: AdminRefundPatchStatus;
  now: Date;
}): void {
  const { storedRefundStatus, paymentStatus, paidAt, next, now } = params;

  if (paymentStatus === "error") {
    throw new AppBadRequestError({
      code: "BILLING_REFUND_NOT_APPLICABLE",
      message: "결제 오류 건은 환불 상태를 변경할 수 없습니다.",
    });
  }

  if (next === "pending") {
    if (storedRefundStatus !== "eligible") {
      throw new AppBadRequestError({
        code: "BILLING_REFUND_INVALID_STATE",
        message: "환불 대기는 [환불 가능] 상태에서만 설정할 수 있습니다.",
      });
    }
    if (!isWithinPaidRefundCalendarWindow(paidAt, now)) {
      throw new AppBadRequestError({
        code: "BILLING_REFUND_WINDOW_CLOSED",
        message: "환불 가능 기간이 지났습니다.",
      });
    }
    return;
  }

  if (next === "completed") {
    if (storedRefundStatus !== "pending") {
      throw new AppBadRequestError({
        code: "BILLING_REFUND_INVALID_STATE",
        message: "환불 완료는 [환불 대기] 상태에서만 설정할 수 있습니다.",
      });
    }
    return;
  }

  if (next === "eligible") {
    if (storedRefundStatus !== "pending") {
      throw new AppBadRequestError({
        code: "BILLING_REFUND_INVALID_STATE",
        message: "[환불 가능]으로 되돌리려면 현재 상태가 [환불 대기]여야 합니다.",
      });
    }
  }
}
