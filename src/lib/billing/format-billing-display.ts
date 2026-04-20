/** KST 기준 `YYYY.MM.DD HH:MM:SS` (어드민 결제 관리 A-2) */
export function formatKstYmdHmsDots(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const mo = pick("month");
  const day = pick("day");
  const h = pick("hour");
  const m = pick("minute");
  const s = pick("second");
  return `${y}.${mo}.${day} ${h}:${m}:${s}`;
}

/** KST 기준 `YYYY.MM.DD` (결제 관리 A-6) */
export function formatKstYmdDots(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const mo = pick("month");
  const day = pick("day");
  return `${y}.${mo}.${day}`;
}

/** KST 기준 `YYYY.MM.DD HH:MM` (회원 결제 관리 B-3, B-4) */
export function formatKstYmdHmDots(iso: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "";
  const y = pick("year");
  const mo = pick("month");
  const day = pick("day");
  const h = pick("hour");
  const m = pick("minute");
  return `${y}.${mo}.${day} ${h}:${m}`;
}

/** `NNNN-****-****-NNNN` (앞·뒤 4자리만 노출) */
export function formatPaymentCardMask(
  bin4: string | null | undefined,
  last4: string | null | undefined,
): string | null {
  const b = (bin4 ?? "").trim().replace(/\D/g, "").slice(0, 4);
  const l = (last4 ?? "").trim().replace(/\D/g, "").slice(0, 4);
  if (b.length !== 4 || l.length !== 4) return null;
  return `${b}-****-****-${l}`;
}
