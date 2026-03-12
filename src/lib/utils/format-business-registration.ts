/**
 * 사업자등록번호: DB 저장 시 사용. 하이픈 제거 후 숫자만 반환.
 */
export function normalizeBusinessRegistration(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  return digits;
}

/**
 * DB에 저장된 숫자만 있는 사업자등록번호를 UI 표시용 xxx-xx-xxxxx 형식으로 변환.
 */
export function formatBusinessRegistrationDisplay(value: string | null | undefined): string {
  if (value == null || typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return value.trim() || "";
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 10)}`;
}
