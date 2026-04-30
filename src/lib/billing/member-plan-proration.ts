import { differenceInCalendarDays } from "date-fns";
import { addCalendarDaysKst, formatKstYmd, kstYmdBoundsUtc } from "@/lib/utils/kst-date";

export type MemberBillingInvoiceLike = {
  usagePeriodStart: string;
  usagePeriodEnd: string;
};

export function roundToHundreds(amountWon: number): number {
  return Math.round(amountWon / 100) * 100;
}

export function inclusiveDaysBetweenKstYmd(startYmd: string, endYmd: string): number {
  const start = kstYmdBoundsUtc(startYmd, false);
  const end = kstYmdBoundsUtc(endYmd, true);
  return Math.max(0, differenceInCalendarDays(end, start) + 1);
}

export function invoiceNextBillingKstYmd(invoice: MemberBillingInvoiceLike): string {
  const endYmd = formatKstYmd(new Date(invoice.usagePeriodEnd));
  return addCalendarDaysKst(endYmd, 1);
}

/**
 * BillingPlanShell과 동일한 “프로→프리미엄 잔여기간 차액(100원 단위)” 계산.
 * - 총/잔여 일수는 KST 달력 기준 inclusive
 */
export function computeProToPremiumUpgradeChargeWonFromInvoice(
  invoice: MemberBillingInvoiceLike,
  now: Date = new Date(),
): {
  startYmd: string;
  endYmd: string;
  todayYmd: string;
  totalDays: number;
  remainingDays: number;
  premiumRemainWonRounded: number;
  proRemainWonRounded: number;
  chargeWonRoundedTo100: number;
  nextBillingKstYmd: string;
} {
  const startYmd = formatKstYmd(new Date(invoice.usagePeriodStart));
  const endYmd = formatKstYmd(new Date(invoice.usagePeriodEnd));
  const todayYmd = formatKstYmd(now);

  const totalDays = inclusiveDaysBetweenKstYmd(startYmd, endYmd);
  const remainingDays = inclusiveDaysBetweenKstYmd(todayYmd, endYmd);

  const premiumMonthly = 22_000;
  const proMonthly = 11_000;

  const premiumRemain = (premiumMonthly * remainingDays) / Math.max(1, totalDays);
  const proRemain = (proMonthly * remainingDays) / Math.max(1, totalDays);

  const b1 = Math.round(premiumRemain);
  const b2 = Math.round(proRemain);
  const b3 = roundToHundreds(b1 - b2);

  return {
    startYmd,
    endYmd,
    todayYmd,
    totalDays,
    remainingDays,
    premiumRemainWonRounded: b1,
    proRemainWonRounded: b2,
    chargeWonRoundedTo100: b3,
    nextBillingKstYmd: invoiceNextBillingKstYmd(invoice),
  };
}
