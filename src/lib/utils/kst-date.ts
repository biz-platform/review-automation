import { addDays } from "date-fns";

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
