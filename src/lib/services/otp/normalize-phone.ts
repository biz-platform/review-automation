/** 한국 휴대번호 → E.164 (+8210...). 82로 시작하면 12자리(82+10), 아니면 11자리(010...) */
export function toE164(phone: string): string {
  const raw = phone.replace(/\D/g, "");
  const d = raw.startsWith("82") ? raw.slice(0, 12) : raw.slice(0, 11);
  if (d.startsWith("82")) return "+" + d;
  if (d.startsWith("0")) return "+82" + d.slice(1);
  return "+82" + d;
}

/** E.164(+821012345678) → 표시용 010-1234-5678 */
export function formatE164ForDisplay(e164: string | null | undefined): string {
  if (!e164 || !e164.trim()) return "—";
  const raw = e164.replace(/\D/g, "");
  const d = raw.startsWith("82")
    ? "0" + raw.slice(2, 12)
    : raw.startsWith("0")
      ? raw.slice(0, 11)
      : "0" + raw.slice(0, 10);
  if (d.length < 11) return "—";
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}
