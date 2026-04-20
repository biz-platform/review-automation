import { differenceInCalendarDays } from "date-fns";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";

/** 결제일(KST 달력) 포함 7일째 말일 — 이 날 23:59까지 환불 가능 창으로 본다 */
export function refundWindowLastInclusiveYmd(paidAt: Date): string {
  const paidYmd = formatKstYmd(paidAt);
  return addCalendarDaysKst(paidYmd, 6);
}

export function isWithinPaidRefundCalendarWindow(
  paidAt: Date,
  now: Date = new Date(),
): boolean {
  const lastYmd = refundWindowLastInclusiveYmd(paidAt);
  const todayYmd = formatKstYmd(now);
  return todayYmd <= lastYmd;
}

/** A-10: D-N일 남음 | 환불 기간 만료 (결제 완료·창 내에서만) */
export function refundWindowSubtext(
  paidAt: Date,
  now: Date = new Date(),
): string {
  if (!isWithinPaidRefundCalendarWindow(paidAt, now)) {
    return "환불 기간 만료";
  }
  const lastYmd = refundWindowLastInclusiveYmd(paidAt);
  const todayYmd = formatKstYmd(now);
  const start = kstYmdBoundsUtc(todayYmd, false);
  const end = kstYmdBoundsUtc(lastYmd, true);
  const n = Math.max(1, differenceInCalendarDays(end, start) + 1);
  return `D-${n}일 남음`;
}
