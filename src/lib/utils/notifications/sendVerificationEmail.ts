function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 회원가입 이메일 인증번호 발송 (Resend).
 * - 프로덕션: Resend로 실제 발송. RESEND_API_KEY 필수.
 * - 로컬: 기본은 발송 없이 true(devCode로 테스트). SEND_VERIFICATION_EMAIL=true 이면 Resend 호출.
 *   Resend 테스트 계정은 수신자를 본인 이메일로만 제한할 수 있음 → 도메인 인증 후 다른 수신자 가능.
 * - 디버깅: DEBUG_RESEND=true 이면 Resend API 응답 전체(data/error)를 콘솔에 출력.
 */
export async function sendVerificationEmail(
  email: string,
  code: string,
): Promise<boolean> {
  const shouldSend =
    // process.env.NODE_ENV === "production" ||
    process.env.SEND_VERIFICATION_EMAIL === "true";

  if (!shouldSend) {
    return true;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[OTP] RESEND_API_KEY is not set.");
    return false;
  }
  const fromEnv = process.env.RESEND_FROM ?? "team@auth.oliview.kr";
  const from =
    fromEnv.includes("<") && fromEnv.includes(">")
      ? fromEnv
      : `올리뷰 <${fromEnv.trim()}>`;
  const html = [
    "<h2>회원가입 인증</h2>",
    "<p>올리뷰에서 보낸 인증번호입니다.</p>",
    `<p><strong>${escapeHtml(code)}</strong></p>`,
    "<p>위 인증번호를 입력해 주세요.</p>",
  ].join("\n");
  const debugResend = process.env.DEBUG_RESEND === "true";

  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from,
      to: email.trim().toLowerCase(),
      subject: "[올리뷰] 이메일 인증번호",
      html,
      text: `회원가입 인증\n\n올리뷰에서 보낸 인증번호입니다.\n\n${code}\n\n위 인증번호를 입력해 주세요.`,
    });

    if (debugResend) {
      console.log("[OTP] Resend response:", JSON.stringify(result, null, 2));
    }

    const { data, error } = result;
    if (error) {
      console.error("[OTP] Resend error:", error);
      if (debugResend) {
        console.error(
          "[OTP] Resend error (raw):",
          JSON.stringify(error, null, 2),
        );
      }
      const errObj = error && typeof error === "object" ? error : {};
      const msg =
        "message" in errObj ? String((errObj as { message: unknown }).message) : "";
      const typeOrCode =
        "type" in errObj
          ? String((errObj as { type: unknown }).type)
          : "code" in errObj
            ? String((errObj as { code: unknown }).code)
            : "";
      const isRecipientInvalid =
        /recipient|doesn't exist|invalid|deactivated|couldn't be delivered|bounced|suppressed|no such user|could not be found|550|5\.1\.1/i.test(
          `${msg} ${typeOrCode}`,
        );
      if (isRecipientInvalid) {
        const err = new Error(msg || "Invalid email recipient") as Error & {
          code: string;
        };
        err.code = "OTP_EMAIL_INVALID";
        throw err;
      }
      return false;
    }
    if (debugResend && data) {
      console.log("[OTP] Resend success, data:", JSON.stringify(data, null, 2));
    }
    return true;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "OTP_EMAIL_INVALID")
      throw e;
    console.error("[OTP] Email send error:", e);
    return false;
  }
}
