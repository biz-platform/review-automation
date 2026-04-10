import { addDays } from "date-fns";
import { MAX_PLATFORM_ORDERS_INCLUSIVE_DAYS } from "@/lib/config/platform-orders-sync";
/** KST 달력 날짜 문자열 YYYY-MM-DD */
export function formatKstYmd(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** KST 해당 일의 시작(00:00) / 끝(23:59:59.999)을 UTC Date로 */
export function kstYmdBoundsUtc(ymd: string, endOfDay: boolean): Date {
  return new Date(
    `${ymd}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+09:00`,
  );
}

export function addCalendarDaysKst(ymd: string, delta: number): string {
  const base = kstYmdBoundsUtc(ymd, false);
  return formatKstYmd(addDays(base, delta));
}

/**
 * 배민·땡겨요·요기요 주문 동기화 공통: KST 달력 기준 **끝일 포함** `inclusiveDays`개의 서로 다른 날.
 * 예) inclusiveDays=60 → [오늘(KST)에서 59일 전] ~ 오늘 → 정확히 60일.
 */
export function platformOrdersStartYmdInclusiveKst(
  endYmd: string,
  inclusiveDays: number,
): string {
  const n = Math.max(1, Math.min(inclusiveDays, MAX_PLATFORM_ORDERS_INCLUSIVE_DAYS));
  return addCalendarDaysKst(endYmd, -(n - 1));
}

/** `now`의 KST 날짜를 끝으로 하는 {@link platformOrdersStartYmdInclusiveKst} 구간. */
export function platformOrdersDateRangeInclusiveKst(
  inclusiveDays: number,
  now: Date = new Date(),
): { startYmd: string; endYmd: string } {
  const endYmd = formatKstYmd(now);
  return {
    endYmd,
    startYmd: platformOrdersStartYmdInclusiveKst(endYmd, inclusiveDays),
  };
}
