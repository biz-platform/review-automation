/** 입력 중인 숫자만(최대 11자리) → 010-1234-5678 표시용 */
export function formatMobileInputDigits(rawDigits: string): string {
  const d = rawDigits.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * DB 저장 형식(+821091692939 등)을 UI 표시용 010-XXXX-XXXX 형식으로 변환.
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  let normalized = digits;
  if (digits.length === 12 && digits.startsWith("82")) {
    normalized = "0" + digits.slice(2);
  }
  if (normalized.length === 11 && normalized.startsWith("010")) {
    return `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}-${normalized.slice(7)}`;
  }
  return phone;
}
