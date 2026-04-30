import { addCalendarDaysKst, formatKstYmd, kstYmdBoundsUtc } from "@/lib/utils/kst-date";

/** `freeAccessEndsAt` 직전 시각이 속한 KST 날짜 = 무료 마지막 당일 (이용현황과 동일) */
function lastInclusiveKstDayBeforeFreeAccessEnds(freeAccessEndsAt: Date): string {
  return formatKstYmd(new Date(freeAccessEndsAt.getTime() - 1));
}

/**
 * 무료 이용 구간이 끝난 **다음날(KST)** = 첫 정기결제일(이용현황 `member_free_trial`의 nextBillingDots와 동일 규칙).
 */
export function firstBillingKstYmdAfterFreeAccessEnds(
  freeAccessEndsAt: Date,
): string {
  const endYmd = lastInclusiveKstDayBeforeFreeAccessEnds(freeAccessEndsAt);
  return addCalendarDaysKst(endYmd, 1);
}

/** 첫 결제일 KST 00:00 시각(UTC Date) — UI에서 `formatKoreanYmd` 등에 사용 */
export function firstBillingDateAtKstStartAfterFreeAccessEnds(
  freeAccessEndsAt: Date,
): Date {
  const ymd = firstBillingKstYmdAfterFreeAccessEnds(freeAccessEndsAt);
  return kstYmdBoundsUtc(ymd, false);
}
