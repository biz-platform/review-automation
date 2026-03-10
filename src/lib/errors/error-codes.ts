export const ERROR_CODES = {
  UNAUTHORIZED: { code: "UNAUTHORIZED", message: "Authentication required" },
  STORE_NOT_FOUND: { code: "STORE_NOT_FOUND", message: "Store not found" },
  REVIEW_NOT_FOUND: { code: "REVIEW_NOT_FOUND", message: "Review not found" },
  REPLY_DRAFT_NOT_FOUND: { code: "REPLY_DRAFT_NOT_FOUND", message: "Reply draft not found" },
  VALIDATION_ERROR: { code: "VALIDATION_ERROR", message: "Validation failed" },
  INTERNAL_SERVER_ERROR: { code: "INTERNAL_SERVER_ERROR", message: "Internal server error" },

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
  OTP_EXPIRED_OR_INVALID: {
    code: "OTP_EXPIRED_OR_INVALID",
    message: "인증번호가 만료되었거나 올바르지 않아요. 다시 요청해주세요.",
  },
  OTP_MISMATCH: { code: "OTP_MISMATCH", message: "인증번호가 올바르지 않습니다" },
} as const;
