/** 한국 휴대번호 → E.164 (+8210...). 82로 시작하면 12자리(82+10), 아니면 11자리(010...) */
export function toE164(phone: string): string {
  const raw = phone.replace(/\D/g, "");
  const d = raw.startsWith("82") ? raw.slice(0, 12) : raw.slice(0, 11);
  if (d.startsWith("82")) return "+" + d;
  if (d.startsWith("0")) return "+82" + d.slice(1);
  return "+82" + d;
}
