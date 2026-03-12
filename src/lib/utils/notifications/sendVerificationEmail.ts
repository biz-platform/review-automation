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
  try {
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: email.trim().toLowerCase(),
      subject: "[올리뷰] 이메일 인증번호",
      html,
      text: `회원가입 인증\n\n올리뷰에서 보낸 인증번호입니다.\n\n${code}\n\n위 인증번호를 입력해 주세요.`,
    });
    if (error) {
      console.error("[OTP] Resend error:", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[OTP] Email send error:", e);
    return false;
  }
}
