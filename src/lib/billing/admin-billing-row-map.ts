import type {
  AdminBillingInvoicePaymentStatus,
  AdminBillingInvoiceRefundStatus,
} from "@/entities/admin/types";
import {
  isWithinPaidRefundCalendarWindow,
  refundWindowSubtext,
} from "@/lib/billing/refund-window";

/** DB 값 + 결제일 7일 경과를 반영한 표시용 환불 상태 */
export function effectiveRefundStatus(
  paymentStatus: AdminBillingInvoicePaymentStatus,
  stored: AdminBillingInvoiceRefundStatus,
  paidAt: Date,
  now: Date,
): AdminBillingInvoiceRefundStatus {
  if (paymentStatus === "error") return "none";
  if (stored === "pending" || stored === "completed") return stored;
  if (stored === "ineligible") return "ineligible";
  if (!isWithinPaidRefundCalendarWindow(paidAt, now)) return "ineligible";
  return "eligible";
}

/** A-10 보조 문구 */
export function refundSubtextForAdminRow(
  paymentStatus: AdminBillingInvoicePaymentStatus,
  effective: AdminBillingInvoiceRefundStatus,
  stored: AdminBillingInvoiceRefundStatus,
  paidAt: Date,
  now: Date,
): string | null {
  if (paymentStatus === "error" || effective === "none") return null;
  if (effective === "completed") return null;
  if (effective === "pending") {
    return refundWindowSubtext(paidAt, now);
  }
  if (effective === "ineligible") {
    if (stored === "ineligible" && isWithinPaidRefundCalendarWindow(paidAt, now)) {
      return "요건 미달";
    }
    return "환불 기간 만료";
  }
  return refundWindowSubtext(paidAt, now);
}
