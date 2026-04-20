import { addCalendarDaysKst } from "@/lib/utils/kst-date";

/** `2026-04-02` → `2026년 04월 02일` (KST 달력 문자열) */
export function formatKoreanLongKstYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymd;
  return `${y}년 ${m.padStart(2, "0")}월 ${d.padStart(2, "0")}일`;
}

/** 자동 해지일 전날까지 이용 가능 (당월 말일 기준 다음 결제 전일과 동일 로직) */
export function lastServiceKstYmdBeforeAutoCancel(autoCancelKstYmd: string): string {
  return addCalendarDaysKst(autoCancelKstYmd, -1);
}
