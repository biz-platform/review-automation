import { RATE_LIMIT_MESSAGE } from "@/lib/constants/verification";

/** Supabase Auth 에러 메시지를 사용자 안내 문구로 매핑 */
export function mapSupabaseAuthError(message: string): string {
  if (message.includes("rate limit") || message.includes("rate_limit"))
    return RATE_LIMIT_MESSAGE;
  if (message.includes("expired") || message.includes("otp_expired"))
    return "인증번호가 만료되어 다시 요청해주세요";
  if (message.includes("invalid") || message.includes("token"))
    return "인증번호가 올바르지 않습니다";
  return message;
}
