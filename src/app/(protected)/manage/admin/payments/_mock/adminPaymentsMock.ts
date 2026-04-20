"use client";

import type { AdminBillingInvoiceRow } from "@/entities/admin/types";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

export const ADMIN_PAYMENTS_MOCK_LIST: AdminBillingInvoiceRow[] = [
  {
    id: "inv_mock_001",
    invoiceCode: "A-123456",
    paidAt: isoDaysAgo(2),
    payerEmail: "example1234@gmail.com",
    payerPhone: "01012345678",
    payerRole: "member",
    planName: "프로 요금제",
    amountWon: 22_000,
    usagePeriodStart: isoMonthsAgo(1),
    usagePeriodEnd: isoMonthsAgo(0),
    referrerCode: "abc1234",
    paymentStatus: "completed",
    refundStatus: "eligible",
    refundSubtext: "D-6일 남음",
  },
  {
    id: "inv_mock_002",
    invoiceCode: "A-123457",
    paidAt: isoDaysAgo(2),
    payerEmail: "example1234@gmail.com",
    payerPhone: "01012345678",
    payerRole: "member",
    planName: "프로 요금제",
    amountWon: 22_000,
    usagePeriodStart: isoMonthsAgo(1),
    usagePeriodEnd: isoMonthsAgo(0),
    referrerCode: "abc1234",
    paymentStatus: "completed",
    refundStatus: "pending",
    refundSubtext: "D-6일 남음",
  },
  {
    id: "inv_mock_003",
    invoiceCode: "A-123458",
    paidAt: isoDaysAgo(2),
    payerEmail: "example1234@gmail.com",
    payerPhone: "01012345678",
    payerRole: "member",
    planName: "프로 요금제",
    amountWon: 22_000,
    usagePeriodStart: isoMonthsAgo(1),
    usagePeriodEnd: isoMonthsAgo(0),
    referrerCode: "abc1234",
    paymentStatus: "completed",
    refundStatus: "completed",
    refundSubtext: "D-6일 남음",
  },
  {
    id: "inv_mock_004",
    invoiceCode: "A-123459",
    paidAt: isoDaysAgo(14),
    payerEmail: "example1234@gmail.com",
    payerPhone: "01012345678",
    payerRole: "member",
    planName: "프로 요금제",
    amountWon: 22_000,
    usagePeriodStart: isoMonthsAgo(2),
    usagePeriodEnd: isoMonthsAgo(1),
    referrerCode: null,
    paymentStatus: "completed",
    refundStatus: "ineligible",
    refundSubtext: "환불 기간 만료",
  },
  {
    id: "inv_mock_005",
    invoiceCode: "A-123460",
    paidAt: isoDaysAgo(1),
    payerEmail: "oops@example.com",
    payerPhone: null,
    payerRole: "member",
    planName: "프로 요금제",
    amountWon: 22_000,
    usagePeriodStart: isoMonthsAgo(1),
    usagePeriodEnd: isoMonthsAgo(0),
    referrerCode: null,
    paymentStatus: "error",
    refundStatus: "none",
    refundSubtext: null,
  },
];

