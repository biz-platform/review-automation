import { addCalendarDaysKst, formatKstYmd } from "@/lib/utils/kst-date";

/** 오늘(KST) 포함 연속 `totalDays`일의 `YYYY-MM-DD` (과거→현재 오름차순). 초기 백필 60일 등에 사용 */
export function kstDateRangeInclusiveEndingToday(totalDays: number): string[] {
  const end = formatKstYmd(new Date());
  const out: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    out.push(addCalendarDaysKst(end, -i));
  }
  return out.reverse();
}

/** 증분: 직전 KST 일 하루 (자정 배치용) */
export function previousKstDateFromToday(): string {
  const today = formatKstYmd(new Date());
  return addCalendarDaysKst(today, -1);
}
