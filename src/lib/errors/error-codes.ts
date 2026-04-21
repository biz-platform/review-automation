export const ERROR_CODES = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "Authentication required" },
  STORE_NOT_FOUND: { code: "STORE_NOT_FOUND", message: "Store not found" },
  REVIEW_NOT_FOUND: { code: "REVIEW_NOT_FOUND", message: "Review not found" },
  REPLY_DRAFT_NOT_FOUND: {
    code: "REPLY_DRAFT_NOT_FOUND",
    message: "Reply draft not found",
  },
  REPLY_DRAFT_NOT_READY: {
    code: "REPLY_DRAFT_NOT_READY",
    message: "Reply draft is not ready",
  },
  /** 사장님 답 또는 배민 운영자 답 등으로 답변 슬롯이 이미 채워진 경우 */
  REPLY_MANAGE_CLOSED: {
    code: "REPLY_MANAGE_CLOSED",
    message: "이미 플랫폼 답변이 있어 초안·등록·수정을 진행할 수 없습니다.",
  },
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", message: "Validation failed" },
  INTERNAL_SERVER_ERROR: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
  },

  // OTP / 인증
  OTP_COOLDOWN: { code: "OTP_COOLDOWN", message: "잠시 후 다시 요청해주세요" },
  OTP_MAX_PER_HOUR: {
    code: "OTP_MAX_PER_HOUR",
    message: "인증번호는 1시간에 최대 5번까지 발송할 수 있어요",
  },
  OTP_SEND_FAILED: {
    code: "OTP_SEND_FAILED",
    message: "인증번호 발송에 실패했어요. 잠시 후 다시 시도해주세요.",
  },
  /** Resend 수신자 없음/잘못된 주소 등 */
  OTP_EMAIL_INVALID: {
    code: "OTP_EMAIL_INVALID",
    message:
      "등록되지 않았거나 잘못된 이메일 주소예요. 주소를 확인한 뒤 다시 시도해주세요.",
  },
  OTP_EXPIRED_OR_INVALID: {
    code: "OTP_EXPIRED_OR_INVALID",
    message: "인증번호가 만료되었거나 올바르지 않아요. 다시 요청해주세요.",
  },
  OTP_MISMATCH: {
    code: "OTP_MISMATCH",
    message: "인증번호가 올바르지 않습니다",
  },
  /** 비밀번호 찾기: 휴대폰 OTP 검증 실패 1시간 5회 초과 */
  OTP_VERIFY_MAX_PER_HOUR: {
    code: "OTP_VERIFY_MAX_PER_HOUR",
    message: "인증번호 확인 시도가 너무 많아요. 잠시 후 다시 시도해주세요.",
  },
  FIND_PASSWORD_PHONE_EMAIL_MISMATCH: {
    code: "FIND_PASSWORD_PHONE_EMAIL_MISMATCH",
    message: "입력한 이메일과 휴대전화 번호가 일치하지 않아요",
  },
  FIND_PASSWORD_SESSION_INVALID: {
    code: "FIND_PASSWORD_SESSION_INVALID",
    message: "세션이 만료되었거나 올바르지 않아요.",
  },
  FIND_PASSWORD_CHECK_FAILED: {
    code: "FIND_PASSWORD_CHECK_FAILED",
    message: "가입 정보 확인에 실패했어요.",
  },
  FIND_PASSWORD_RESET_FAILED: {
    code: "FIND_PASSWORD_RESET_FAILED",
    message: "비밀번호 변경에 실패했어요.",
  },
} as const;
