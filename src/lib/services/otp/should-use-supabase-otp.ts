/**
 * OTP 저장소 선택.
 *
 * 인메모리(store Map)는 Next dev 멀티 워커·HMR 시 발송 POST와 검증 POST가 서로 다른
 * 프로세스로 가면 저장소가 달라져 항상 OTP_EXPIRED_OR_INVALID가 난다.
 *
 * 기본은 Supabase `verification_otp` 테이블(마이그레이션 033). 오프라인 등에서만
 * `VERIFICATION_OTP_USE_MEMORY=true` 로 인메모리 사용.
 */
export function shouldUseSupabaseOtp(): boolean {
  return process.env.VERIFICATION_OTP_USE_MEMORY !== "true";
}
