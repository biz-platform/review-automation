import { formatE164ForDisplay } from "@/lib/services/otp/normalize-phone";

/** E.164 휴대번호 → 010-1234-**** 마스킹 표시 */
export function maskPhone(phone: string | null | undefined): string {
  const formatted = formatE164ForDisplay(phone);
  if (formatted === "—") return "—";
  return formatted.slice(0, -4) + "****";
}

/** ISO 날짜 문자열 → yyyy.mm.dd hh:mm:ss (실패 시 "—") */
export function formatDateTime(iso: string | null | undefined): string {
  if (iso == null || iso === "") return "—";
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const h = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return `${y}.${m}.${day} ${h}:${min}:${s}`;
  } catch {
    return "—";
  }
}

/** 금액(원) → "1,234원" (0원은 "0원") */
export function formatAmount(amount: number): string {
  if (amount === 0) return "0원";
  return `${amount.toLocaleString("ko-KR")}원`;
}
