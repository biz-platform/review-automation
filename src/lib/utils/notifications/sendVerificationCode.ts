import CoolsmsMessageService from "coolsms-node-sdk";
import { ENV_KEY } from "@/lib/config/env-keys";
import { getCoolsmsCredentialsFromEnv } from "@/lib/config/server-env-readers";

/** E.164(+821012345678) → CoolSMS 수신 형식(01012345678). 훅(send-sms)과 동일 규칙 */
function toLocalPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("82")) return "0" + digits.slice(2);
  if (digits.startsWith("0")) return digits.slice(0, 11);
  return digits.length >= 9 ? "0" + digits.slice(-9) : "0" + digits;
}

/**
 * 인증번호 SMS 발송 (CoolSMS)
 * 환경변수 설정 시 개발/프로덕션 모두 실제 CoolSMS 서버로 발송.
 */
export async function sendVerificationCode(
  phoneNumber: string,
  code: string,
): Promise<boolean> {
  const creds = getCoolsmsCredentialsFromEnv();
  if (!creds) {
    console.error("CoolSMS 환경변수가 설정되지 않았습니다.");
    return false;
  }

  try {
    const to = toLocalPhone(phoneNumber);
    if (process.env[ENV_KEY.NODE_ENV] !== "production") {
      console.log(
        "[OTP] CoolSMS 발송 요청 to: ***" + to.slice(-4),
        "code:",
        code,
      );
    }
    const messageService = new CoolsmsMessageService(
      creds.apiKey,
      creds.apiSecret,
    );
    await messageService.sendMany([
      {
        to,
        from: creds.sender,
        text: `[올리뷰] 인증번호: ${code}\n5분 이내에 입력해주세요.`,
      } as Parameters<CoolsmsMessageService["sendMany"]>[0][number],
    ]);
    if (process.env[ENV_KEY.NODE_ENV] !== "production") {
      console.log("[OTP] CoolSMS 발송 완료");
    }
    return true;
  } catch (error) {
    console.error("[OTP] CoolSMS 발송 실패:", error);
    return false;
  }
}
