import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import CoolsmsMessageService from "coolsms-node-sdk";

/**
 * Supabase Auth Send SMS Hook.
 * 대시보드에서 Phone 인증 시 사용할 훅 URL로 이 엔드포인트를 등록하고,
 * CoolSMS 일반 SMS로 OTP를 발송한다.
 *
 * 환경변수: SEND_SMS_HOOK_SECRET, COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER
 * @see https://supabase.com/docs/guides/auth/auth-hooks/send-sms-hook
 */

const COOLSMS_API_KEY = process.env.COOLSMS_API_KEY;
const COOLSMS_API_SECRET = process.env.COOLSMS_API_SECRET;
const COOLSMS_SENDER = process.env.COOLSMS_SENDER;
const SEND_SMS_HOOK_SECRET = process.env.SEND_SMS_HOOK_SECRET;

/** E.164(+821012345678) → CoolSMS 수신 형식(01012345678) */
function toLocalPhone(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.startsWith("82") && digits.length === 11) return "0" + digits.slice(2);
  if (digits.startsWith("82") && digits.length === 12) return "0" + digits.slice(2);
  return e164.replace(/\D/g, "").replace(/^82/, "0");
}

export async function POST(request: NextRequest) {
  if (!SEND_SMS_HOOK_SECRET) {
    console.error("[send-sms-hook] SEND_SMS_HOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Send SMS hook is not configured" },
      { status: 500 },
    );
  }
  if (!COOLSMS_API_KEY || !COOLSMS_API_SECRET || !COOLSMS_SENDER) {
    console.error("[send-sms-hook] CoolSMS env (COOLSMS_API_KEY, COOLSMS_API_SECRET, COOLSMS_SENDER) missing");
    return NextResponse.json(
      { error: "SMS provider is not configured" },
      { status: 500 },
    );
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  try {
    const secret =
      SEND_SMS_HOOK_SECRET.startsWith("v1,whsec_") ?
        SEND_SMS_HOOK_SECRET.replace("v1,whsec_", "") :
        SEND_SMS_HOOK_SECRET;
    const wh = new Webhook(secret);
    const payload = wh.verify(rawBody, headers) as { user: { phone?: string }; sms: { otp?: string } };
    const phone = payload?.user?.phone;
    const otp = payload?.sms?.otp;
    if (!phone || !otp) {
      return NextResponse.json(
        { error: "Missing user.phone or sms.otp" },
        { status: 400 },
      );
    }

    const to = toLocalPhone(phone);
    const text = `[인증번호] ${otp}`;
    const messageService = new CoolsmsMessageService(COOLSMS_API_KEY!, COOLSMS_API_SECRET!);
    await messageService.sendMany([
      { to, from: COOLSMS_SENDER!, text } as Parameters<CoolsmsMessageService["sendMany"]>[0][number],
    ]);

    return new NextResponse(null, { status: 200 });
  } catch (err) {
    if (err instanceof Error && err.name === "WebhookVerificationError") {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
    }
    console.error("[send-sms-hook]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send SMS" },
      { status: 500 },
    );
  }
}
