import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import CoolsmsMessageService from "coolsms-node-sdk";

/**
 * Supabase Auth Send SMS Hook.
 * 대시보드에서 Phone 인증 시 사용할 훅 URL로 이 엔드포인트를 등록하고,
 * CoolSMS로 OTP SMS를 발송한다.
 *
 * 대시보드: Authentication → Hooks → Send SMS → HTTP 선택 후
 *   - URL: https://<도메인>/api/auth/hooks/send-sms (오타 주의: send-sms)
 *   - Secret: Supabase가 생성한 값 → Vercel env SEND_SMS_HOOK_SECRET에 동일하게 설정
 * 훅이 활성화되면 내장 SMS 프로바이더(Twilio 등) 없이 이 훅만 호출됨.
 *
 * 환경변수: SEND_SMS_HOOK_SECRET, COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 * @see https://supabase.com/docs/guides/auth/phone-login
 */

const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const COOLSMS_SENDER = process.env.COOLSMS_SENDER;
const SEND_SMS_HOOK_SECRET = process.env.SEND_SMS_HOOK_SECRET;

/** E.164(+821012345678) → CoolSMS 수신 형식(01012345678) */
function toLocalPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length === 11)
    return "0" + digits.slice(2);
  if (digits.startsWith("82") && digits.length === 12)
    return "0" + digits.slice(2);
  return e164.replace(/\D/g, "").replace(/^82/, "0");
}

const DEBUG = process.env.DEBUG_SEND_SMS_HOOK === "true";

export async function POST(request: NextRequest) {
  // 훅 호출 여부 확인용: 항상 1줄 로그 (Vercel에서 이 로그가 없으면 Supabase가 이 URL을 호출하지 않는 것)
  console.log("[send-sms-hook] POST received");

  if (!SEND_SMS_HOOK_SECRET) {
    console.error("[send-sms-hook] SEND_SMS_HOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Send SMS hook is not configured" },
      { status: 500 },
    );
  }
  if (!COOLSMS_API_KEY || !COOLSMS_API_SECRET || !COOLSMS_SENDER) {
    console.error(
      "[send-sms-hook] CoolSMS env (COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER) missing",
    );
    return NextResponse.json(
      { error: "SMS provider is not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  if (DEBUG)
    console.log(
      "[send-sms-hook] body length:",
      rawBody.length,
      "has svix headers:",
      !!request.headers.get("svix-id"),
    );

  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    const secret = SEND_SMS_HOOK_SECRET.startsWith("v1,whsec_")
      ? SEND_SMS_HOOK_SECRET.replace("v1,whsec_", "")
      : SEND_SMS_HOOK_SECRET;
    const wh = new Webhook(secret);
    const payload = wh.verify(rawBody, headers) as {
      user: { phone?: string };
      sms: { otp?: string };
    };
    const phone = payload?.user?.phone;
    const otp = payload?.sms?.otp;

    if (DEBUG) {
      const mask = (s: string) =>
        s && s.length > 4 ? "***" + s.slice(-4) : "***";
      console.log(
        "[send-sms-hook] payload ok, phone:",
        mask(phone ?? ""),
        "otp length:",
        otp?.length ?? 0,
      );
    }

    if (!phone || !otp) {
      if (DEBUG)
        console.log("[send-sms-hook] missing phone or otp", {
          hasPhone: !!phone,
          hasOtp: !!otp,
        });
      return NextResponse.json(
        { error: "Missing user.phone or sms.otp" },
        { status: 400 },
      );
    }

    const to = toLocalPhone(phone);
    const text = `[인증번호] ${otp}`;
    if (DEBUG)
      console.log(
        "[send-sms-hook] calling CoolSMS to:",
        "***" + to.slice(-4),
        "from:",
        COOLSMS_SENDER,
      );

    const messageService = new CoolsmsMessageService(
      COOLSMS_API_KEY,
      COOLSMS_API_SECRET,
    );
    // SDK sendMany accepts Message[]; plain { to, from, text } works at runtime
    const result = await messageService.sendMany([
      { to, from: COOLSMS_SENDER, text } as Parameters<
        CoolsmsMessageService["sendMany"]
      >[0][number],
    ]);

    if (DEBUG)
      console.log(
        "[send-sms-hook] CoolSMS sendMany result:",
        JSON.stringify(result),
      );
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "WebhookVerificationError") {
      if (DEBUG)
        console.log("[send-sms-hook] WebhookVerificationError:", err.message);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }
    console.error("[send-sms-hook]", err);
    if (DEBUG && err instanceof Error) {
      console.error("[send-sms-hook] stack:", err.stack);
      if ("response" in err)
        console.error(
          "[send-sms-hook] response:",
          (err as { response?: unknown }).response,
        );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send SMS" },
      { status: 500 },
    );
  }
}
